import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { toPublicRobotTaskBatch } from "@herbert/server/persistence/operations/robotTaskQueue/batchHelpers";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import type { RobotTaskActionBatch } from "@herbert/shared";
import type { RobotTaskQueueBatch } from "@herbert/shared/robotTaskQueue";

export interface ClaimNextRobotTaskBatchOptions {
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

/**
 * Atomically claims the next queued action batch (oldest first) by flipping
 * its status from `queued` to `claimed`. Returns the public batch shape that
 * the robot worker polls. Returns `undefined` when no queued batch is ready.
 */
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
  const queue = await readQueueDocument({ store });
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

  const claimedBatch: RobotTaskQueueBatch = {
    ...batch,
    status: "claimed",
    claimedAtMs: nowMs,
  };

  await writeQueueDocument({
    store,
    queue: {
      ...queue,
      batches: queue.batches.map((candidate, index) =>
        index === batchIndex ? claimedBatch : candidate,
      ),
    },
  });

  return toPublicRobotTaskBatch({ batch: claimedBatch });
}
