import { robotTaskActionLimits, robotTaskActionSchema } from "@herbert/shared";
import { z } from "zod";

export const telegramOpenAIActionLimits = robotTaskActionLimits;

export const telegramReplyTextSchema = z.string().trim().min(1).max(4_096);
export const spokenTextSchema = z.string().trim().min(1).max(300);
export const taskStateSchema = z.string().trim().min(1).max(2_000);

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
