import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import type {
  RobotTaskQueueBatch,
  RobotTaskSession,
} from "@herbert/shared/robotTaskQueue";

const MAX_TASK_STATE_LENGTH = 2_000;
const MAX_FAILURE_MESSAGE_LENGTH = 500;

export interface FailRobotTaskBatchOptions {
  readonly batchId: string;
  readonly taskId: string;
  readonly errorMessage?: string;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface FailRobotTaskBatchResult {
  readonly batch: RobotTaskQueueBatch;
  readonly session: RobotTaskSession;
  readonly changed: boolean;
}

/**
 * Marks a queued/claimed batch abandoned after the robot worker reports that
 * local execution failed. Completed or already-abandoned batches are left
 * untouched, which makes late/duplicate failure reports safe.
 */
export async function failRobotTaskBatch({
  batchId,
  taskId,
  errorMessage,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: FailRobotTaskBatchOptions): Promise<FailRobotTaskBatchResult> {
  return await withRobotTaskQueueLock(async () => {
    const queue = await readQueueDocument({ store });
    const batchIndex = queue.batches.findIndex(
      (batch) => batch.id === batchId && batch.taskId === taskId,
    );
    const batch = batchIndex === -1 ? undefined : queue.batches[batchIndex];

    if (batch === undefined) {
      throw new Error(`Unknown robot action batch: ${batchId}`);
    }

    const sessionIndex = queue.sessions.findIndex(
      (candidate) => candidate.id === taskId,
    );
    const session =
      sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

    if (session === undefined) {
      throw new Error(`Unknown robot task session: ${taskId}`);
    }

    if (batch.status === "completed" || batch.status === "abandoned") {
      return { batch, session, changed: false };
    }

    const failedBatch: RobotTaskQueueBatch = {
      ...batch,
      status: "abandoned",
      abandonedAtMs: nowMs,
    };
    const updatedSession: RobotTaskSession = {
      ...session,
      updatedAtMs: nowMs,
      taskState: appendFailureToTaskState({
        taskState: session.taskState,
        batchId,
        errorMessage,
      }),
    };

    await writeQueueDocument({
      store,
      queue: {
        sessions: queue.sessions.map((candidate, index) =>
          index === sessionIndex ? updatedSession : candidate,
        ),
        batches: queue.batches.map((candidate, index) =>
          index === batchIndex ? failedBatch : candidate,
        ),
      },
    });

    return {
      batch: failedBatch,
      session: updatedSession,
      changed: true,
    };
  });
}

function appendFailureToTaskState({
  taskState,
  batchId,
  errorMessage,
}: {
  readonly taskState: string;
  readonly batchId: string;
  readonly errorMessage?: string;
}): string {
  const failureLine = `Robot worker failed batch ${batchId}: ${compactFailureMessage(errorMessage)}. The robot stopped and will keep monitoring for new work.`;
  const base = taskState.trim();
  const combined = `${base}\n${failureLine}`;

  if (combined.length <= MAX_TASK_STATE_LENGTH) {
    return combined;
  }

  const baseLimit = Math.max(
    0,
    MAX_TASK_STATE_LENGTH - failureLine.length - "\n...\n".length,
  );
  return `${base.slice(0, baseLimit).trimEnd()}\n...\n${failureLine}`;
}

function compactFailureMessage(errorMessage: string | undefined): string {
  const value = errorMessage?.trim();

  if (value === undefined || value.length === 0) {
    return "unknown error";
  }

  return value.replaceAll(/\s+/g, " ").slice(0, MAX_FAILURE_MESSAGE_LENGTH);
}
