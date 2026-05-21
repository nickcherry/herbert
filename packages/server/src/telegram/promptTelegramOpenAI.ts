import { telegramConfig } from "@herbert/server/constants/telegram";
import { promptOpenAI } from "@herbert/server/openai";
import { buildTelegramOpenAIPrompt } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import type { TelegramHistoryMessage } from "@herbert/server/telegram/telegramMessageHistory";
import {
  parseExecutableTelegramOpenAIResponse,
  telegramOpenAIActionLimits,
  type TelegramOpenAIResponse,
  telegramOpenAIResponseSchema,
} from "@herbert/server/telegram/telegramOpenAIResponse";

export interface PromptTelegramOpenAIOptions {
  readonly currentMessage: TelegramHistoryMessage;
  readonly recentMessages: readonly TelegramHistoryMessage[];
}

export async function promptTelegramOpenAI({
  currentMessage,
  recentMessages,
}: PromptTelegramOpenAIOptions): Promise<TelegramOpenAIResponse> {
  const response = await promptOpenAI({
    prompt: buildTelegramOpenAIPrompt({ currentMessage, recentMessages }),
    schema: telegramOpenAIResponseSchema,
    schemaName: "telegram_robot_response",
    instructions: telegramOpenAIInstructions,
  });

  return parseExecutableTelegramOpenAIResponse({ response });
}

export const telegramOpenAIInstructions = [
  "You process authorized Telegram admin messages for Herbert, a SunFounder PiCar-X robot car.",
  "Return the Telegram reply in `message` and zero or more bounded robot action plans in `actions`.",
  "`message` must be non-empty, concise, and suitable to send as plain Telegram text.",
  "`actions` may be empty. Use empty actions for conversation, status questions, unclear requests, or anything that does not clearly ask Herbert to act.",
  "Do not move Herbert unless the current admin message clearly asks for movement.",
  `Return at most ${telegramOpenAIActionLimits.maxActions} actions.`,
  `Drive speed must be ${telegramOpenAIActionLimits.speed.min}-${telegramOpenAIActionLimits.speed.max}.`,
  `Drive durationMs must be ${telegramOpenAIActionLimits.durationMs.min}-${telegramOpenAIActionLimits.durationMs.max}. Prefer short pulses.`,
  `Steering and drive_arc angle must be ${telegramOpenAIActionLimits.steeringAngle.min}-${telegramOpenAIActionLimits.steeringAngle.max}; negative is left, positive is right, 0 is centered.`,
  `Camera panDelta and tiltDelta must be ${telegramOpenAIActionLimits.cameraDelta.min}-${telegramOpenAIActionLimits.cameraDelta.max}; pan negative is left, pan positive is right, tilt positive is up, tilt negative is down.`,
  `For \`/ping\`, reply exactly \`${telegramConfig.pingResponseText}\` and return no actions.`,
  "For stop, halt, emergency stop, or similar messages, return a `stop` action.",
].join("\n");
