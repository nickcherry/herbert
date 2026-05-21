import { extractTelegramMessages } from "@herbert/server/telegram/extractTelegramMessages";
import type { TelegramMessage } from "@herbert/server/telegram/schemas";
import { describe, expect, test } from "bun:test";

describe("extractTelegramMessages", () => {
  test("extracts message and edited_message payloads", () => {
    const message = buildMessage({ id: 1 });
    const editedMessage = buildMessage({ id: 2 });

    expect(
      extractTelegramMessages({
        updates: [
          {
            update_id: 10,
            message,
          },
          {
            update_id: 11,
            edited_message: editedMessage,
          },
          {
            update_id: 12,
          },
        ],
      }),
    ).toEqual([message, editedMessage]);
  });
});

function buildMessage({ id }: { readonly id: number }): TelegramMessage {
  return {
    message_id: id,
    date: 1,
    chat: {
      id: 123,
      type: "private",
    },
    text: "/ping",
  };
}
