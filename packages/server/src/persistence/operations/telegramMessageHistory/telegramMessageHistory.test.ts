import { telegramConfig } from "@herbert/server/constants/telegram";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  appendTelegramMessageHistory,
  appendTelegramMessageHistoryBatch,
  filterRecentTelegramMessages,
  readTelegramMessageHistory,
} from "@herbert/server/persistence/operations/telegramMessageHistory";
import { describe, expect, test } from "bun:test";

describe("telegramMessageHistory operations", () => {
  test("keeps only the most recent Telegram context messages per chat", async () => {
    const store = createMemoryDocumentStore();

    for (
      let index = 1;
      index <= telegramConfig.openAIContextMessageLimit + 2;
      index += 1
    ) {
      await appendTelegramMessageHistory({
        chatId: "123",
        store,
        message: {
          messageId: index,
          date: 1_800_000_000 + index,
          text: `message ${index}`,
          sender: "unknown",
        },
      });
    }

    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from(
        { length: telegramConfig.openAIContextMessageLimit },
        (_value, index) => {
          const messageId = index + 3;

          return {
            messageId,
            date: 1_800_000_000 + messageId,
            text: `message ${messageId}`,
            sender: "unknown",
          };
        },
      ),
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
        sender: "unknown",
      },
    });
    await appendTelegramMessageHistory({
      chatId: "456",
      store,
      message: {
        messageId: 2,
        date: 1_800_000_001,
        text: "two",
        sender: "unknown",
      },
    });

    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual([
      {
        messageId: 1,
        date: 1_800_000_000,
        text: "one",
        sender: "unknown",
      },
    ]);
    expect(await readTelegramMessageHistory({ chatId: "456", store })).toEqual([
      {
        messageId: 2,
        date: 1_800_000_001,
        text: "two",
        sender: "unknown",
      },
    ]);
  });

  test("filterRecentTelegramMessages drops messages older than the cutoff", () => {
    const nowMs = 600_000;
    const maxAgeMs = 180_000;
    const messages = [
      { messageId: 1, date: 100, text: "way old", sender: "Nick" },
      { messageId: 2, date: 500, text: "fresh enough", sender: "Nick" },
      { messageId: 3, date: 350, text: "older than cutoff", sender: "Nick" },
      { messageId: 4, date: 580, text: "fresh", sender: "Nick" },
    ];

    expect(filterRecentTelegramMessages({ messages, nowMs, maxAgeMs })).toEqual(
      [
        { messageId: 2, date: 500, text: "fresh enough", sender: "Nick" },
        { messageId: 4, date: 580, text: "fresh", sender: "Nick" },
      ],
    );
  });

  test("appends batches while preserving the context limit", async () => {
    const store = createMemoryDocumentStore();

    for (
      let index = 1;
      index <= telegramConfig.openAIContextMessageLimit - 2;
      index += 1
    ) {
      await appendTelegramMessageHistory({
        chatId: "123",
        store,
        message: {
          messageId: index,
          date: 1_800_000_000 + index,
          text: `message ${index}`,
          sender: "unknown",
        },
      });
    }

    await appendTelegramMessageHistoryBatch({
      chatId: "123",
      store,
      messages: [
        telegramConfig.openAIContextMessageLimit - 1,
        telegramConfig.openAIContextMessageLimit,
        telegramConfig.openAIContextMessageLimit + 1,
      ].map((messageId) => ({
        messageId,
        date: 1_800_000_000 + messageId,
        text: `message ${messageId}`,
        sender: "unknown",
      })),
    });

    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from(
        { length: telegramConfig.openAIContextMessageLimit },
        (_value, index) => {
          const messageId = index + 2;

          return {
            messageId,
            date: 1_800_000_000 + messageId,
            text: `message ${messageId}`,
            sender: "unknown",
          };
        },
      ),
    );
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
