import { speechTextSchema } from "@herbert/shared";
import { z } from "zod";

export const telegramOpenAIActionLimits = {
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

export const telegramReplyTextSchema = z.string().trim().min(1).max(4_096);

const driveDirectionSchema = z.enum(["forward", "backward"]);

const driveActionSchema = z.object({
  type: z.enum(["drive"]),
  direction: driveDirectionSchema,
  speed: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.speed.min)
    .max(telegramOpenAIActionLimits.speed.max),
  durationMs: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.durationMs.min)
    .max(telegramOpenAIActionLimits.durationMs.max),
});

const driveArcActionSchema = z.object({
  type: z.enum(["drive_arc"]),
  direction: driveDirectionSchema,
  angle: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.steeringAngle.min)
    .max(telegramOpenAIActionLimits.steeringAngle.max),
  speed: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.speed.min)
    .max(telegramOpenAIActionLimits.speed.max),
  durationMs: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.durationMs.min)
    .max(telegramOpenAIActionLimits.durationMs.max),
});

const setSteeringActionSchema = z.object({
  type: z.enum(["set_steering"]),
  angle: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.steeringAngle.min)
    .max(telegramOpenAIActionLimits.steeringAngle.max),
});

const lookActionSchema = z.object({
  type: z.enum(["look"]),
  panDelta: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.cameraDelta.min)
    .max(telegramOpenAIActionLimits.cameraDelta.max),
  tiltDelta: z
    .number()
    .int()
    .min(telegramOpenAIActionLimits.cameraDelta.min)
    .max(telegramOpenAIActionLimits.cameraDelta.max),
});

const takePhotoActionSchema = z.object({
  type: z.enum(["take_photo"]),
});

const openAISayActionSchema = z.object({
  type: z.enum(["say"]),
  text: z.string().trim(),
});

const executableSayActionSchema = openAISayActionSchema.extend({
  text: speechTextSchema,
});

const stopActionSchema = z.object({
  type: z.enum(["stop"]),
});

/**
 * OpenAI Structured Outputs supports nested `anyOf`; z.union emits `anyOf`,
 * while z.discriminatedUnion currently emits `oneOf`.
 */
export const telegramOpenAIActionSchema = z.union([
  driveActionSchema,
  driveArcActionSchema,
  setSteeringActionSchema,
  lookActionSchema,
  takePhotoActionSchema,
  openAISayActionSchema,
  stopActionSchema,
]);

export const executableTelegramOpenAIActionSchema = z.union([
  driveActionSchema,
  driveArcActionSchema,
  setSteeringActionSchema,
  lookActionSchema,
  takePhotoActionSchema,
  executableSayActionSchema,
  stopActionSchema,
]);

export const telegramOpenAIResponseSchema = z.object({
  message: z.string().trim(),
  actions: z
    .array(telegramOpenAIActionSchema)
    .max(telegramOpenAIActionLimits.maxActions),
});

export const executableTelegramOpenAIResponseSchema = z.object({
  message: telegramReplyTextSchema,
  actions: z
    .array(executableTelegramOpenAIActionSchema)
    .max(telegramOpenAIActionLimits.maxActions),
});

export type TelegramOpenAIResponse = z.infer<
  typeof executableTelegramOpenAIResponseSchema
>;

export function parseExecutableTelegramOpenAIResponse({
  response,
}: {
  readonly response: z.infer<typeof telegramOpenAIResponseSchema>;
}): TelegramOpenAIResponse {
  return executableTelegramOpenAIResponseSchema.parse(response);
}
