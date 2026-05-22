import { robotTaskActionLimits, robotTaskActionSchema } from "@herbert/shared";
import { z } from "zod";

export const telegramOpenAIActionLimits = robotTaskActionLimits;

export const telegramOpenAIResponseLimits = {
  telegramMessage: { min: 1, max: 4_096 },
  spokenMessage: { min: 1, max: 300 },
  taskState: { min: 1, max: 2_000 },
} as const;

export const telegramReplyTextSchema = z
  .string()
  .trim()
  .min(telegramOpenAIResponseLimits.telegramMessage.min)
  .max(telegramOpenAIResponseLimits.telegramMessage.max);
export const spokenTextSchema = z
  .string()
  .trim()
  .min(telegramOpenAIResponseLimits.spokenMessage.min)
  .max(telegramOpenAIResponseLimits.spokenMessage.max);
export const taskStateSchema = z
  .string()
  .trim()
  .min(telegramOpenAIResponseLimits.taskState.min)
  .max(telegramOpenAIResponseLimits.taskState.max);

const nullableTelegramMessageSchema = z.union([z.string().trim(), z.null()]);
const nullableSpokenMessageSchema = z.union([z.string().trim(), z.null()]);

export const telegramOpenAIResponseSchema = z.object({
  telegramMessage: nullableTelegramMessageSchema,
  spokenMessage: nullableSpokenMessageSchema,
  taskState: z.string().trim(),
  isFinished: z.boolean(),
  actions: z
    .array(robotTaskActionSchema)
    .max(telegramOpenAIActionLimits.maxActions),
});

export const executableTelegramOpenAIResponseSchema = z
  .object({
    telegramMessage: telegramReplyTextSchema.nullable(),
    spokenMessage: spokenTextSchema.nullable(),
    taskState: taskStateSchema,
    isFinished: z.boolean(),
    actions: z
      .array(robotTaskActionSchema)
      .max(telegramOpenAIActionLimits.maxActions),
  })
  .refine(
    (response) => !response.isFinished || response.actions.length === 0,
    "isFinished responses must not include more robot actions.",
  )
  .refine(
    (response) =>
      response.isFinished ||
      response.actions.length > 0 ||
      response.telegramMessage !== null,
    "Unfinished responses must queue robot actions or send a Telegram message.",
  );

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
