import { z } from "zod";

export const robotTaskActionLimits = {
  maxActions: 5,
  speed: {
    min: 1,
    max: 50,
  },
  durationMs: {
    min: 100,
    max: 1_000,
  },
  steeringAngle: {
    min: -30,
    max: 30,
  },
  cameraDelta: {
    min: -10,
    max: 10,
  },
} as const;

export const robotTaskBatchIdSchema = z.string().min(1);
export const robotTaskSessionIdSchema = z.string().min(1);

const driveDirectionSchema = z.enum(["forward", "backward"]);

const driveActionSchema = z.object({
  type: z.enum(["drive"]),
  direction: driveDirectionSchema,
  speed: z
    .number()
    .int()
    .min(robotTaskActionLimits.speed.min)
    .max(robotTaskActionLimits.speed.max),
  durationMs: z
    .number()
    .int()
    .min(robotTaskActionLimits.durationMs.min)
    .max(robotTaskActionLimits.durationMs.max),
});

const driveArcActionSchema = z.object({
  type: z.enum(["drive_arc"]),
  direction: driveDirectionSchema,
  angle: z
    .number()
    .int()
    .min(robotTaskActionLimits.steeringAngle.min)
    .max(robotTaskActionLimits.steeringAngle.max),
  speed: z
    .number()
    .int()
    .min(robotTaskActionLimits.speed.min)
    .max(robotTaskActionLimits.speed.max),
  durationMs: z
    .number()
    .int()
    .min(robotTaskActionLimits.durationMs.min)
    .max(robotTaskActionLimits.durationMs.max),
});

const setSteeringActionSchema = z.object({
  type: z.enum(["set_steering"]),
  angle: z
    .number()
    .int()
    .min(robotTaskActionLimits.steeringAngle.min)
    .max(robotTaskActionLimits.steeringAngle.max),
});

const lookActionSchema = z.object({
  type: z.enum(["look"]),
  panDelta: z
    .number()
    .int()
    .min(robotTaskActionLimits.cameraDelta.min)
    .max(robotTaskActionLimits.cameraDelta.max),
  tiltDelta: z
    .number()
    .int()
    .min(robotTaskActionLimits.cameraDelta.min)
    .max(robotTaskActionLimits.cameraDelta.max),
});

const takePhotoActionSchema = z.object({
  type: z.enum(["take_photo"]),
});

const stopActionSchema = z.object({
  type: z.enum(["stop"]),
});

/**
 * OpenAI Structured Outputs supports nested `anyOf`; z.union emits `anyOf`,
 * while z.discriminatedUnion currently emits `oneOf`.
 */
export const robotTaskActionSchema = z.union([
  driveActionSchema,
  driveArcActionSchema,
  setSteeringActionSchema,
  lookActionSchema,
  takePhotoActionSchema,
  stopActionSchema,
]);

export const robotTaskActionBatchSchema = z.object({
  id: robotTaskBatchIdSchema,
  taskId: robotTaskSessionIdSchema,
  actions: z
    .array(robotTaskActionSchema)
    .min(1)
    .max(robotTaskActionLimits.maxActions),
});

export const robotTaskActionBatchPollResponseSchema = z.object({
  ok: z.literal(true),
  batch: robotTaskActionBatchSchema.nullable(),
});

export const robotTaskActionBatchCompleteResponseSchema = z.object({
  ok: z.literal(true),
  accepted: z.literal(true),
});

export type RobotTaskAction = z.infer<typeof robotTaskActionSchema>;
export type RobotTaskActionBatch = z.infer<typeof robotTaskActionBatchSchema>;
export type RobotTaskActionBatchPollResponse = z.infer<
  typeof robotTaskActionBatchPollResponseSchema
>;
export type RobotTaskActionBatchCompleteResponse = z.infer<
  typeof robotTaskActionBatchCompleteResponseSchema
>;
