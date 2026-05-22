import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import {
  type RobotTaskCommentary,
  robotTaskCommentarySchema,
  type RobotTaskQueueBatch,
  type RobotTaskSession,
} from "@herbert/shared/robotTaskQueue";

const MAX_PERSISTED_COMMENTARY_ENTRIES = 20;

export interface CompleteRobotTaskBatchOptions {
  readonly batchId: string;
  readonly taskId: string;
  readonly photoPath: string;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface CompleteRobotTaskBatchResult {
  readonly batch: RobotTaskQueueBatch;
  readonly session: RobotTaskSession;
  readonly commentary: RobotTaskCommentary;
}

/**
 * Marks a claimed batch as completed, appends a new commentary entry to the
 * owning session, and returns the completed batch and updated session.
 * Throws if the batch or session can't be found, or if the batch is already
 * marked completed.
 */
export async function completeRobotTaskBatch({
  batchId,
  taskId,
  photoPath,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: CompleteRobotTaskBatchOptions): Promise<CompleteRobotTaskBatchResult> {
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
}: Required<CompleteRobotTaskBatchOptions>): Promise<CompleteRobotTaskBatchResult> {
  const queue = await readQueueDocument({ store });
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

  const completedBatch: RobotTaskQueueBatch = {
    ...batch,
    status: "completed",
    completedAtMs: nowMs,
  };
  const commentary: RobotTaskCommentary = robotTaskCommentarySchema.parse({
    batchId,
    completedAtMs: nowMs,
    photoPath,
    actions: batch.actions,
  });
  const updatedSession: RobotTaskSession = {
    ...session,
    updatedAtMs: nowMs,
    commentary: [...session.commentary, commentary].slice(
      -MAX_PERSISTED_COMMENTARY_ENTRIES,
    ),
  };

  await writeQueueDocument({
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
    commentary,
  };
}
