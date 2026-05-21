import { authorizeTelegramMessage } from "@herbert/server/telegram/authorizeTelegramMessage";
import type { TelegramMessage } from "@herbert/server/telegram/schemas";
import { describe, expect, test } from "bun:test";

describe("authorizeTelegramMessage", () => {
  test("authorizes admin text messages", () => {
    expect(
      authorizeTelegramMessage({
        message: buildTelegramMessage({ chatId: 123, text: "/ping" }),
        adminChatIds: ["123"],
      }),
    ).toMatchObject({
      authorized: true,
      chatId: "123",
      text: "/ping",
    });
  });

  test("rejects messages from unlisted chats", () => {
    expect(
      authorizeTelegramMessage({
        message: buildTelegramMessage({ chatId: 123, text: "/ping" }),
        adminChatIds: ["456"],
      }),
    ).toMatchObject({
      authorized: false,
      chatId: "123",
      reason: "chat id is not configured as a Telegram admin",
    });
  });

  test("rejects admin messages without text", () => {
    expect(
      authorizeTelegramMessage({
        message: buildTelegramMessage({ chatId: 123 }),
        adminChatIds: ["123"],
      }),
    ).toMatchObject({
      authorized: false,
      chatId: "123",
      reason: "message has no text",
    });
  });
});

function buildTelegramMessage({
  chatId,
  text,
}: {
  readonly chatId: number;
  readonly text?: string;
}): TelegramMessage {
  return {
    message_id: 1,
    date: 1,
    chat: {
      id: chatId,
      type: "private",
    },
    text,
  };
}
