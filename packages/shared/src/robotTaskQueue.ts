import {
  cameraAngleSchema,
  steeringAngleSchema,
} from "@herbert/shared/commands";
import {
  robotTaskActionBatchSchema,
  robotTaskHistoricalActionSchema,
} from "@herbert/shared/robotTasks";
import { z } from "zod";

export const robotTaskCameraPositionSchema = z.object({
  pan: cameraAngleSchema,
  tilt: cameraAngleSchema,
});

export type RobotTaskCameraPosition = z.infer<
  typeof robotTaskCameraPositionSchema
>;

const robotTaskPhotoObservationTextSchema = z.string().trim().min(1);

export const robotTaskPhotoObservationDistanceEstimateSchema = z.object({
  subject: robotTaskPhotoObservationTextSchema.max(120),
  category: z.enum([
    "target",
    "route_marker",
    "possible_blocker",
    "landmark",
    "other",
  ]),
  distanceCm: z.number().int().nonnegative().max(1_000).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const robotTaskBatchPhotoObservationOpenAISchema = z.object({
  summary: robotTaskPhotoObservationTextSchema.max(240),
  targetProgress: robotTaskPhotoObservationTextSchema.max(240).nullable(),
  navigableSpace: robotTaskPhotoObservationTextSchema.max(240),
  notableObjects: z.array(robotTaskPhotoObservationTextSchema.max(120)).max(6),
  distanceEstimates: z
    .array(robotTaskPhotoObservationDistanceEstimateSchema)
    .max(6),
  viewQuality: z.enum(["poor", "partial", "good"]),
  recommendedNextMove: robotTaskPhotoObservationTextSchema.max(240).nullable(),
});

export const robotTaskBatchPhotoObservationSchema = z.preprocess((value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  return record.distanceEstimates === undefined
    ? { ...record, distanceEstimates: [] }
    : value;
}, robotTaskBatchPhotoObservationOpenAISchema);

export type RobotTaskPhotoObservationDistanceEstimate = z.infer<
  typeof robotTaskPhotoObservationDistanceEstimateSchema
>;

export type RobotTaskBatchPhotoObservation = z.infer<
  typeof robotTaskBatchPhotoObservationSchema
>;

/**
 * Single batch-report entry persisted on a task session: the actions the robot
 * just completed plus the on-disk path of the photo it captured at the end of
 * the batch. Each batch report corresponds to one completed action batch.
 */
export const robotTaskBatchReportSchema = z.object({
  batchId: z.string().min(1),
  completedAtMs: z.number().int().nonnegative(),
  photoPath: z.string().min(1),
  cameraPosition: robotTaskCameraPositionSchema.optional(),
  steeringAngle: steeringAngleSchema.optional(),
  distanceCm: z.number().finite().nonnegative().optional(),
  photoObservation: robotTaskBatchPhotoObservationSchema.optional(),
  actions: z.array(robotTaskHistoricalActionSchema),
});

export type RobotTaskBatchReport = z.infer<typeof robotTaskBatchReportSchema>;

/**
 * Persisted task session. One active session per admin chat id at a time; the
 * `batchReports` array is the recent batch-report log (the slice cap is
 * enforced by the operation that writes the session).
 */
export const robotTaskSessionSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  status: z.enum(["active", "finished"]),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  taskState: z.string().min(1),
  batchReports: z.array(robotTaskBatchReportSchema).max(20),
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
