import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  appendTelegramMessageHistory,
  readTelegramMessageHistory,
} from "@herbert/server/telegram/telegramMessageHistory";
import { describe, expect, test } from "bun:test";

describe("telegramMessageHistory", () => {
  test("keeps only the most recent Telegram context messages per chat", async () => {
    const store = createMemoryDocumentStore();

    for (let index = 1; index <= 12; index += 1) {
      await appendTelegramMessageHistory({
        chatId: "123",
        store,
        message: {
          messageId: index,
          date: 1_800_000_000 + index,
          text: `message ${index}`,
        },
      });
    }

    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from({ length: 10 }, (_value, index) => {
        const messageId = index + 3;

        return {
          messageId,
          date: 1_800_000_000 + messageId,
          text: `message ${messageId}`,
        };
      }),
    );
  });

  test("stores admin chats independently", async () => {
    const store = createMemoryDocumentStore();

    await appendTelegramMessageHistory({
      chatId: "123",
      store,
      message: {
        messageId: 1,
        date: 1_800_000_000,
        text: "one",
      },
    });
    await appendTelegramMessageHistory({
      chatId: "456",
      store,
      message: {
        messageId: 2,
        date: 1_800_000_001,
        text: "two",
      },
    });

    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual([
      {
        messageId: 1,
        date: 1_800_000_000,
        text: "one",
      },
    ]);
    expect(await readTelegramMessageHistory({ chatId: "456", store })).toEqual([
      {
        messageId: 2,
        date: 1_800_000_001,
        text: "two",
      },
    ]);
  });
});

function createMemoryDocumentStore(): DocumentStore {
  const documents = new Map<string, unknown>();

  return {
    async read({ collection, key, schema }) {
      const value = documents.get(`${collection}:${key}`);
      return value === undefined ? undefined : schema.parse(value);
    },
    async write({ collection, key, schema, value }) {
      documents.set(`${collection}:${key}`, schema.parse(value));
    },
  } satisfies DocumentStore;
}
