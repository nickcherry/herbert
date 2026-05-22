import {
  robotTaskActionBatchSchema,
  robotTaskActionSchema,
} from "@herbert/shared/robotTasks";
import { z } from "zod";

/**
 * Single robot-commentary entry persisted on a task session: the actions the
 * robot just completed plus the on-disk path of the photo it captured at the
 * end of the batch. Each commentary entry corresponds to one completed batch.
 */
export const robotTaskCommentarySchema = z.object({
  batchId: z.string().min(1),
  completedAtMs: z.number().int().nonnegative(),
  photoPath: z.string().min(1),
  actions: z.array(robotTaskActionSchema),
});

export type RobotTaskCommentary = z.infer<typeof robotTaskCommentarySchema>;

/**
 * Persisted task session. One active session per admin chat id at a time; the
 * `commentary` array is the recent commentary log (the slice cap is enforced
 * by the operation that writes the session).
 */
export const robotTaskSessionSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  status: z.enum(["active", "finished"]),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  taskState: z.string().min(1),
  commentary: z.array(robotTaskCommentarySchema).max(20),
});

export type RobotTaskSession = z.infer<typeof robotTaskSessionSchema>;

/**
 * Persisted shape of a queued/claimed/completed/abandoned action batch. The
 * action contract itself lives in `@herbert/shared/robotTasks`; this schema
 * adds the queue-state fields used by the server's robot task queue.
 */
export const robotTaskQueueBatchSchema = robotTaskActionBatchSchema.extend({
  chatId: z.string().min(1),
  status: z.enum(["queued", "claimed", "completed", "abandoned"]),
  createdAtMs: z.number().int().nonnegative(),
  claimedAtMs: z.number().int().nonnegative().optional(),
  completedAtMs: z.number().int().nonnegative().optional(),
  abandonedAtMs: z.number().int().nonnegative().optional(),
});

export type RobotTaskQueueBatch = z.infer<typeof robotTaskQueueBatchSchema>;

/**
 * Persisted shape of the entire robot task queue document. Stored under
 * `collection: robot_task_queue, key: default`. Sessions and batches are
 * capped here defensively; the runtime slice caps live in the operations.
 */
export const robotTaskQueueDocumentSchema = z.object({
  sessions: z.array(robotTaskSessionSchema).max(50),
  batches: z.array(robotTaskQueueBatchSchema).max(200),
});

export type RobotTaskQueueDocument = z.infer<
  typeof robotTaskQueueDocumentSchema
>;
