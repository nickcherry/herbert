import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import {
  type RobotTaskAction,
  type RobotTaskActionBatch,
  robotTaskActionBatchSchema,
  robotTaskActionSchema,
} from "@herbert/shared";
import { z } from "zod";

export const robotTaskObservationSchema = z.object({
  batchId: z.string().min(1),
  completedAtMs: z.number().int().nonnegative(),
  photoPath: z.string().min(1),
  actions: z.array(robotTaskActionSchema),
});

export const robotTaskSessionSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  status: z.enum(["active", "finished"]),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  taskState: z.string().min(1),
  observations: z.array(robotTaskObservationSchema).max(20),
});

const storedRobotTaskBatchSchema = robotTaskActionBatchSchema.extend({
  chatId: z.string().min(1),
  status: z.enum(["queued", "claimed", "completed"]),
  createdAtMs: z.number().int().nonnegative(),
  claimedAtMs: z.number().int().nonnegative().optional(),
  completedAtMs: z.number().int().nonnegative().optional(),
});

const robotTaskQueueDocumentSchema = z.object({
  sessions: z.array(robotTaskSessionSchema).max(50),
  batches: z.array(storedRobotTaskBatchSchema).max(200),
});

export type RobotTaskObservation = z.infer<typeof robotTaskObservationSchema>;
export type RobotTaskSession = z.infer<typeof robotTaskSessionSchema>;

type StoredRobotTaskBatch = z.infer<typeof storedRobotTaskBatchSchema>;
type RobotTaskQueueDocument = z.infer<typeof robotTaskQueueDocumentSchema>;

export interface RobotTaskContext {
  readonly session?: RobotTaskSession;
}

export interface RecordRobotTaskResponseOptions {
  readonly chatId: string;
  readonly response: TelegramOpenAIResponse;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface ClaimNextRobotTaskBatchOptions {
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface CompleteRobotTaskBatchOptions {
  readonly batchId: string;
  readonly taskId: string;
  readonly photoPath: string;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export async function readRobotTaskContext({
  chatId,
  store = defaultDocumentStore(),
}: {
  readonly chatId: string;
  readonly store?: DocumentStore;
}): Promise<RobotTaskContext> {
  return await withRobotTaskQueueLock(async () => {
    return await readRobotTaskContextUnlocked({ chatId, store });
  });
}

async function readRobotTaskContextUnlocked({
  chatId,
  store,
}: {
  readonly chatId: string;
  readonly store: DocumentStore;
}): Promise<RobotTaskContext> {
  const queue = await readQueue({ store });
  const sessionIndex = findLatestActiveSessionIndex({
    sessions: queue.sessions,
    chatId,
  });
  const session =
    sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

  return { session };
}

export async function recordRobotTaskResponse({
  chatId,
  response,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: RecordRobotTaskResponseOptions): Promise<{
  readonly session: RobotTaskSession;
  readonly batch?: RobotTaskActionBatch;
}> {
  return await withRobotTaskQueueLock(async () => {
    return await recordRobotTaskResponseUnlocked({
      chatId,
      response,
      nowMs,
      store,
    });
  });
}

async function recordRobotTaskResponseUnlocked({
  chatId,
  response,
  nowMs,
  store,
}: Required<RecordRobotTaskResponseOptions>): Promise<{
  readonly session: RobotTaskSession;
  readonly batch?: RobotTaskActionBatch;
}> {
  const queue = await readQueue({ store });
  const sessionIndex = findLatestActiveSessionIndex({
    sessions: queue.sessions,
    chatId,
  });
  const existingSession =
    sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];
  const session = existingSession ?? createRobotTaskSession({ chatId, nowMs });

  const updatedSession: RobotTaskSession = {
    ...session,
    status: response.isFinished ? "finished" : "active",
    updatedAtMs: nowMs,
    taskState: response.taskState,
  };

  const sessions =
    sessionIndex === -1
      ? [...queue.sessions, updatedSession]
      : queue.sessions.map((candidate, index) =>
          index === sessionIndex ? updatedSession : candidate,
        );

  const batch =
    response.actions.length > 0
      ? createRobotTaskBatch({
          chatId,
          taskId: updatedSession.id,
          actions: response.actions,
          nowMs,
        })
      : undefined;
  const batches =
    batch === undefined ? queue.batches : [...queue.batches, batch];

  await writeQueue({
    store,
    queue: {
      sessions: sessions.slice(-50),
      batches: batches.slice(-200),
    },
  });

  return {
    session: updatedSession,
    ...(batch === undefined ? {} : { batch: publicRobotTaskBatch({ batch }) }),
  };
}

export async function claimNextRobotTaskBatch({
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: ClaimNextRobotTaskBatchOptions = {}): Promise<
  RobotTaskActionBatch | undefined
> {
  return await withRobotTaskQueueLock(async () => {
    return await claimNextRobotTaskBatchUnlocked({ nowMs, store });
  });
}

async function claimNextRobotTaskBatchUnlocked({
  nowMs,
  store,
}: Required<ClaimNextRobotTaskBatchOptions>): Promise<
  RobotTaskActionBatch | undefined
> {
  const queue = await readQueue({ store });
  const batchIndex = queue.batches.findIndex(
    (batch) => batch.status === "queued",
  );

  if (batchIndex === -1) {
    return undefined;
  }

  const batch = queue.batches[batchIndex];
  if (batch === undefined) {
    return undefined;
  }

  const claimedBatch: StoredRobotTaskBatch = {
    ...batch,
    status: "claimed",
    claimedAtMs: nowMs,
  };

  await writeQueue({
    store,
    queue: {
      ...queue,
      batches: queue.batches.map((candidate, index) =>
        index === batchIndex ? claimedBatch : candidate,
      ),
    },
  });

  return publicRobotTaskBatch({ batch: claimedBatch });
}

export async function completeRobotTaskBatch({
  batchId,
  taskId,
  photoPath,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: CompleteRobotTaskBatchOptions): Promise<{
  readonly batch: StoredRobotTaskBatch;
  readonly session: RobotTaskSession;
  readonly observation: RobotTaskObservation;
}> {
  return await withRobotTaskQueueLock(async () => {
    return await completeRobotTaskBatchUnlocked({
      batchId,
      taskId,
      photoPath,
      nowMs,
      store,
    });
  });
}

async function completeRobotTaskBatchUnlocked({
  batchId,
  taskId,
  photoPath,
  nowMs,
  store,
}: Required<CompleteRobotTaskBatchOptions>): Promise<{
  readonly batch: StoredRobotTaskBatch;
  readonly session: RobotTaskSession;
  readonly observation: RobotTaskObservation;
}> {
  const queue = await readQueue({ store });
  const batchIndex = queue.batches.findIndex(
    (batch) => batch.id === batchId && batch.taskId === taskId,
  );
  const batch = batchIndex === -1 ? undefined : queue.batches[batchIndex];

  if (batch === undefined) {
    throw new Error(`Unknown robot action batch: ${batchId}`);
  }

  if (batch.status === "completed") {
    throw new Error(`Robot action batch is already completed: ${batchId}`);
  }

  const sessionIndex = queue.sessions.findIndex(
    (candidate) => candidate.id === taskId,
  );
  const session =
    sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

  if (session === undefined) {
    throw new Error(`Unknown robot task session: ${taskId}`);
  }

  const completedBatch: StoredRobotTaskBatch = {
    ...batch,
    status: "completed",
    completedAtMs: nowMs,
  };
  const observation: RobotTaskObservation = robotTaskObservationSchema.parse({
    batchId,
    completedAtMs: nowMs,
    photoPath,
    actions: batch.actions,
  });
  const updatedSession: RobotTaskSession = {
    ...session,
    updatedAtMs: nowMs,
    observations: [...session.observations, observation].slice(-20),
  };

  await writeQueue({
    store,
    queue: {
      sessions: queue.sessions.map((candidate, index) =>
        index === sessionIndex ? updatedSession : candidate,
      ),
      batches: queue.batches.map((candidate, index) =>
        index === batchIndex ? completedBatch : candidate,
      ),
    },
  });

  return {
    batch: completedBatch,
    session: updatedSession,
    observation,
  };
}

function createRobotTaskSession({
  chatId,
  nowMs,
}: {
  readonly chatId: string;
  readonly nowMs: number;
}): RobotTaskSession {
  return robotTaskSessionSchema.parse({
    id: `task_${nowMs}_${randomIdSegment()}`,
    chatId,
    status: "active",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    taskState: "New task started from Telegram. No robot observations yet.",
    observations: [],
  });
}

function createRobotTaskBatch({
  chatId,
  taskId,
  actions,
  nowMs,
}: {
  readonly chatId: string;
  readonly taskId: string;
  readonly actions: readonly RobotTaskAction[];
  readonly nowMs: number;
}): StoredRobotTaskBatch {
  return storedRobotTaskBatchSchema.parse({
    id: `batch_${nowMs}_${randomIdSegment()}`,
    taskId,
    chatId,
    status: "queued",
    createdAtMs: nowMs,
    actions,
  });
}

function publicRobotTaskBatch({
  batch,
}: {
  readonly batch: StoredRobotTaskBatch;
}): RobotTaskActionBatch {
  return robotTaskActionBatchSchema.parse({
    id: batch.id,
    taskId: batch.taskId,
    actions: batch.actions,
  });
}

async function readQueue({
  store,
}: {
  readonly store: DocumentStore;
}): Promise<RobotTaskQueueDocument> {
  const queue = await store.read({
    ...robotTaskQueueDocument(),
    schema: robotTaskQueueDocumentSchema,
  });

  return queue ?? { sessions: [], batches: [] };
}

async function writeQueue({
  store,
  queue,
}: {
  readonly store: DocumentStore;
  readonly queue: RobotTaskQueueDocument;
}): Promise<void> {
  await store.write({
    ...robotTaskQueueDocument(),
    schema: robotTaskQueueDocumentSchema,
    value: queue,
  });
}

function robotTaskQueueDocument(): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: "robot_task_queue",
    key: "default",
  };
}

function randomIdSegment(): string {
  return Math.random().toString(36).slice(2, 10);
}

function findLatestActiveSessionIndex({
  sessions,
  chatId,
}: {
  readonly sessions: readonly RobotTaskSession[];
  readonly chatId: string;
}): number {
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const candidate = sessions[index];

    if (candidate?.chatId === chatId && candidate.status === "active") {
      return index;
    }
  }

  return -1;
}

let robotTaskQueueLock: Promise<void> = Promise.resolve();

async function withRobotTaskQueueLock<Result>(
  run: () => Promise<Result>,
): Promise<Result> {
  const previous = robotTaskQueueLock;
  let release: () => void = () => {};
  robotTaskQueueLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await run();
  } finally {
    release();
  }
}
