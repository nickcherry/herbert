import type { TelegramMessage } from "@herbert/server/telegram/schemas";

export interface AuthorizedTelegramMessage {
  readonly authorized: true;
  readonly chatId: string;
  readonly text: string;
  readonly message: TelegramMessage;
}

export interface UnauthorizedTelegramMessage {
  readonly authorized: false;
  readonly chatId: string;
  readonly reason: string;
  readonly message: TelegramMessage;
}

export type TelegramMessageAuthorization =
  | AuthorizedTelegramMessage
  | UnauthorizedTelegramMessage;

export function authorizeTelegramMessage({
  message,
  adminChatIds,
}: {
  readonly message: TelegramMessage;
  readonly adminChatIds: readonly string[];
}): TelegramMessageAuthorization {
  const chatId = String(message.chat.id);
  const text = message.text?.trim();

  if (!adminChatIds.includes(chatId)) {
    return {
      authorized: false,
      chatId,
      reason: "chat id is not configured as a Telegram admin",
      message,
    };
  }

  if (text === undefined || text.length === 0) {
    return {
      authorized: false,
      chatId,
      reason: "message has no text",
      message,
    };
  }

  return {
    authorized: true,
    chatId,
    text,
    message,
  };
}
