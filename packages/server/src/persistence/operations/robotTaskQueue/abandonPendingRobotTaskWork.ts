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

export interface AbandonPendingRobotTaskWorkOptions {
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface AbandonPendingRobotTaskWorkResult {
  readonly abandonedBatchCount: number;
  readonly finishedSessionCount: number;
}

/**
 * Sweeps the queue on server startup. Any batch still in `queued` or
 * `claimed` from a previous run is marked `abandoned`, and any `active`
 * session is marked `finished`. We can't tell whether crashed work ran to
 * completion or not, so we treat it as done — the queue will never replay a
 * stale batch.
 */
export async function abandonPendingRobotTaskWork({
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: AbandonPendingRobotTaskWorkOptions = {}): Promise<AbandonPendingRobotTaskWorkResult> {
  return await withRobotTaskQueueLock(async () => {
    const queue = await readQueueDocument({ store });

    let abandonedBatchCount = 0;
    const batches: RobotTaskQueueBatch[] = queue.batches.map((batch) => {
      if (batch.status !== "queued" && batch.status !== "claimed") {
        return batch;
      }
      abandonedBatchCount += 1;
      return {
        ...batch,
        status: "abandoned",
        abandonedAtMs: nowMs,
      };
    });

    let finishedSessionCount = 0;
    const sessions: RobotTaskSession[] = queue.sessions.map((session) => {
      if (session.status !== "active") {
        return session;
      }
      finishedSessionCount += 1;
      return {
        ...session,
        status: "finished",
        updatedAtMs: nowMs,
      };
    });

    if (abandonedBatchCount === 0 && finishedSessionCount === 0) {
      return { abandonedBatchCount, finishedSessionCount };
    }

    await writeQueueDocument({
      store,
      queue: {
        sessions,
        batches,
      },
    });

    return { abandonedBatchCount, finishedSessionCount };
  });
}
