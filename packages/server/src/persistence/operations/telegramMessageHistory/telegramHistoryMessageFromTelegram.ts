import type { TelegramMessage } from "@herbert/server/telegram/schemas";
import {
  type TelegramHistoryMessage,
  telegramHistoryMessageSchema,
} from "@herbert/shared/telegramMessageHistory";

/**
 * Constructs a persisted history entry from a raw Telegram API message and
 * its authorized text. The sender is resolved against a small priority list
 * so logs and prompts always show something recognizable.
 */
export function telegramHistoryMessageFromTelegram({
  message,
  text,
}: {
  readonly message: TelegramMessage;
  readonly text: string;
}): TelegramHistoryMessage {
  return telegramHistoryMessageSchema.parse({
    messageId: message.message_id,
    date: message.date,
    text,
    sender: senderNameFromTelegramMessage({ message }),
  });
}

function senderNameFromTelegramMessage({
  message,
}: {
  readonly message: TelegramMessage;
}): string {
  const from = message.from;
  const candidates = [
    from?.first_name,
    from?.username,
    message.chat.first_name,
    message.chat.username,
    message.chat.title,
    String(message.chat.id),
  ];

  return (
    candidates.find((candidate) => hasText(candidate))?.trim() ?? "unknown"
  );
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}
