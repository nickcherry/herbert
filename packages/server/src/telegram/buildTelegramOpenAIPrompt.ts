import type { TelegramHistoryMessage } from "@herbert/server/telegram/telegramMessageHistory";

export interface BuildTelegramOpenAIPromptOptions {
  readonly currentMessage: TelegramHistoryMessage;
  readonly recentMessages: readonly TelegramHistoryMessage[];
}

export function buildTelegramOpenAIPrompt({
  currentMessage,
  recentMessages,
}: BuildTelegramOpenAIPromptOptions): string {
  return [
    "Recent authorized Telegram messages from this admin chat, oldest first, excluding the current message:",
    formatRecentMessages({ messages: recentMessages }),
    "Current authorized Telegram message:",
    formatTelegramHistoryMessage({ message: currentMessage }),
  ].join("\n\n");
}

function formatRecentMessages({
  messages,
}: {
  readonly messages: readonly TelegramHistoryMessage[];
}): string {
  if (messages.length === 0) {
    return "none";
  }

  return messages
    .map((message, index) => {
      return `${index + 1}. ${formatTelegramHistoryMessage({ message })}`;
    })
    .join("\n");
}

function formatTelegramHistoryMessage({
  message,
}: {
  readonly message: TelegramHistoryMessage;
}): string {
  return JSON.stringify({
    messageId: message.messageId,
    sentAt: new Date(message.date * 1_000).toISOString(),
    text: message.text,
  });
}
