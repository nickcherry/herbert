import {
  type RobotTaskActionBatch,
  robotTaskActionBatchSchema,
} from "@herbert/shared";
import type { RobotTaskQueueBatch } from "@herbert/shared/robotTaskQueue";

/**
 * Strips persisted queue-state fields from a stored batch to produce the
 * public `RobotTaskActionBatch` returned over the HTTP API to the robot.
 */
export function toPublicRobotTaskBatch({
  batch,
}: {
  readonly batch: RobotTaskQueueBatch;
}): RobotTaskActionBatch {
  return robotTaskActionBatchSchema.parse({
    id: batch.id,
    taskId: batch.taskId,
    actions: batch.actions,
  });
}
