import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { toPublicRobotTaskBatch } from "@herbert/server/persistence/operations/robotTaskQueue/batchHelpers";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import {
  findLatestActiveSessionIndex,
  randomIdSegment,
} from "@herbert/server/persistence/operations/robotTaskQueue/sessionHelpers";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import type { RobotTaskAction, RobotTaskActionBatch } from "@herbert/shared";
import {
  type RobotTaskQueueBatch,
  robotTaskQueueBatchSchema,
  type RobotTaskSession,
  robotTaskSessionSchema,
} from "@herbert/shared/robotTaskQueue";

const MAX_PERSISTED_SESSIONS = 50;
const MAX_PERSISTED_BATCHES = 200;

export interface RecordRobotTaskResponseOptions {
  readonly chatId: string;
  readonly response: TelegramOpenAIResponse;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface RecordRobotTaskResponseResult {
  readonly session: RobotTaskSession;
  readonly batch?: RobotTaskActionBatch;
}

/**
 * Persists the result of a Telegram OpenAI turn onto the active task session
 * for the chat (creating a new session if none exists), and queues any
 * returned actions as a fresh action batch. Caller invariants:
 *
 * - `response.taskState` is the new durable memory for the next turn.
 * - `response.isFinished=true` ends the session; the executable schema
 *   guarantees `actions` is empty in that case.
 * - `response.actions.length > 0` produces a new queued batch tied to the
 *   updated session.
 */
export async function recordRobotTaskResponse({
  chatId,
  response,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: RecordRobotTaskResponseOptions): Promise<RecordRobotTaskResponseResult> {
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
}: Required<RecordRobotTaskResponseOptions>): Promise<RecordRobotTaskResponseResult> {
  const queue = await readQueueDocument({ store });
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

  await writeQueueDocument({
    store,
    queue: {
      sessions: sessions.slice(-MAX_PERSISTED_SESSIONS),
      batches: batches.slice(-MAX_PERSISTED_BATCHES),
    },
  });

  return {
    session: updatedSession,
    ...(batch === undefined
      ? {}
      : { batch: toPublicRobotTaskBatch({ batch }) }),
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
    taskState: "New task started from Telegram. No batch reports yet.",
    batchReports: [],
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
}): RobotTaskQueueBatch {
  return robotTaskQueueBatchSchema.parse({
    id: `batch_${nowMs}_${randomIdSegment()}`,
    taskId,
    chatId,
    status: "queued",
    createdAtMs: nowMs,
    actions,
  });
}
