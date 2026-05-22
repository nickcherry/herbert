import { z } from "zod";

export const robotTaskActionLimits = {
  maxActions: 5,
  speed: {
    min: 50,
    max: 100,
  },
  durationMs: {
    min: 1_000,
    max: 3_000,
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

/**
 * Permissive bounds for persisted historical records (queued/claimed/
 * completed batches and per-session batch reports). They sit between the
 * strict OpenAI-facing `robotTaskActionLimits` and the raw hardware ranges
 * in `commands.ts`. Historical records are read-only context for the model,
 * so they must remain parseable even when we tighten the live action floor.
 */
export const robotTaskHistoricalActionLimits = {
  speed: {
    min: 1,
    max: 100,
  },
  durationMs: {
    min: 1,
    max: 10_000,
  },
  steeringAngle: {
    min: -35,
    max: 35,
  },
  cameraDelta: {
    min: -35,
    max: 35,
  },
} as const;

export const robotTaskBatchIdSchema = z.string().min(1);
export const robotTaskSessionIdSchema = z.string().min(1);

const driveDirectionSchema = z.enum(["forward", "backward"]);

type RobotTaskActionRangeLimits = {
  readonly speed: { readonly min: number; readonly max: number };
  readonly durationMs: { readonly min: number; readonly max: number };
  readonly steeringAngle: { readonly min: number; readonly max: number };
  readonly cameraDelta: { readonly min: number; readonly max: number };
};

function buildRobotTaskActionSchema(limits: RobotTaskActionRangeLimits) {
  const driveActionSchema = z.object({
    type: z.enum(["drive"]),
    direction: driveDirectionSchema,
    speed: z.number().int().min(limits.speed.min).max(limits.speed.max),
    durationMs: z
      .number()
      .int()
      .min(limits.durationMs.min)
      .max(limits.durationMs.max),
  });

  const driveArcActionSchema = z.object({
    type: z.enum(["drive_arc"]),
    direction: driveDirectionSchema,
    angle: z
      .number()
      .int()
      .min(limits.steeringAngle.min)
      .max(limits.steeringAngle.max),
    speed: z.number().int().min(limits.speed.min).max(limits.speed.max),
    durationMs: z
      .number()
      .int()
      .min(limits.durationMs.min)
      .max(limits.durationMs.max),
  });

  const setSteeringActionSchema = z.object({
    type: z.enum(["set_steering"]),
    angle: z
      .number()
      .int()
      .min(limits.steeringAngle.min)
      .max(limits.steeringAngle.max),
  });

  const lookActionSchema = z.object({
    type: z.enum(["look"]),
    panDelta: z
      .number()
      .int()
      .min(limits.cameraDelta.min)
      .max(limits.cameraDelta.max),
    tiltDelta: z
      .number()
      .int()
      .min(limits.cameraDelta.min)
      .max(limits.cameraDelta.max),
  });

  const takePhotoActionSchema = z.object({
    type: z.enum(["take_photo"]),
  });

  const stopActionSchema = z.object({
    type: z.enum(["stop"]),
  });

  return z.union([
    driveActionSchema,
    driveArcActionSchema,
    setSteeringActionSchema,
    lookActionSchema,
    takePhotoActionSchema,
    stopActionSchema,
  ]);
}

/**
 * Strict OpenAI-facing action schema: enforces the bold-movement floor. Used
 * for the OpenAI Structured Outputs contract.
 *
 * OpenAI Structured Outputs supports nested `anyOf`; z.union emits `anyOf`,
 * while z.discriminatedUnion currently emits `oneOf`.
 */
export const robotTaskActionSchema = buildRobotTaskActionSchema(
  robotTaskActionLimits,
);

/**
 * Permissive action schema for persisted/historical records. Accepts any
 * shape the hardware bridge ever emitted, so old data keeps parsing when
 * the strict floor changes.
 */
export const robotTaskHistoricalActionSchema = buildRobotTaskActionSchema(
  robotTaskHistoricalActionLimits,
);

export const robotTaskActionBatchSchema = z.object({
  id: robotTaskBatchIdSchema,
  taskId: robotTaskSessionIdSchema,
  actions: z.array(robotTaskHistoricalActionSchema).min(1),
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
