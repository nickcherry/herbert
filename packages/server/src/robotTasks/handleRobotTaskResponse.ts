import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { recordRobotTaskResponse } from "@herbert/server/robotTasks/robotTaskStore";
import {
  sendTelegramMessage,
  type SendTelegramMessageParams,
  type SendTelegramMessageResult,
} from "@herbert/server/telegram/sendTelegramMessage";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import pc from "picocolors";

export interface HandleRobotTaskResponseOptions {
  readonly botToken: string;
  readonly chatId: string;
  readonly response: TelegramOpenAIResponse;
  readonly store?: DocumentStore;
  readonly sendMessage?: SendTelegramMessage;
}

export type SendTelegramMessage = (
  options: SendTelegramMessageParams,
) => Promise<SendTelegramMessageResult>;

export async function handleRobotTaskResponse({
  botToken,
  chatId,
  response,
  store,
  sendMessage = sendTelegramMessage,
}: HandleRobotTaskResponseOptions): Promise<void> {
  if (response.telegramMessage !== null) {
    await sendMessage({
      botToken,
      chatId,
      text: response.telegramMessage,
    });
  }

  if (response.spokenMessage !== null) {
    process.stdout.write(
      `${pc.bold("spoken")} ${formatKeyValue({
        key: "text",
        value: JSON.stringify(response.spokenMessage),
      })}\n`,
    );
  }

  await recordRobotTaskResponse({
    chatId,
    response,
    store,
  });
}

function formatKeyValue({
  key,
  value,
}: {
  readonly key: string;
  readonly value: string;
}): string {
  return `${pc.dim(`${key}=`)}${value}`;
}

export type RobotTaskSendTelegramMessageParams = SendTelegramMessageParams;
