import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import type { PromptTelegramOpenAIOptions } from "@herbert/server/telegram/promptTelegramOpenAI";
import {
  pollIntervalForState,
  startTelegramPolling,
} from "@herbert/server/telegram/runTelegramMonitor";
import type { SendTelegramMessageParams } from "@herbert/server/telegram/sendTelegramMessage";
import {
  appendTelegramMessageHistory,
  readTelegramMessageHistory,
} from "@herbert/server/telegram/telegramMessageHistory";
import { describe, expect, test } from "bun:test";

describe("pollIntervalForState", () => {
  test("uses the cold interval before any message has been received", () => {
    expect(
      pollIntervalForState({
        state: {},
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_000,
      }),
    ).toBe(10_000);
  });

  test("uses the active interval inside the active window", () => {
    expect(
      pollIntervalForState({
        state: {
          lastReceivedAtMs: 90_000,
        },
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_000,
      }),
    ).toBe(2_000);
  });

  test("returns to the cold interval outside the active window", () => {
    expect(
      pollIntervalForState({
        state: {
          lastReceivedAtMs: 60_000,
        },
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_001,
      }),
    ).toBe(10_000);
  });
});

describe("startTelegramPolling", () => {
  test("sends authorized admin message batches with recent context to OpenAI", async () => {
    const store = createMemoryDocumentStore();

    for (let index = 1; index <= 10; index += 1) {
      await appendTelegramMessageHistory({
        chatId: "123",
        store,
        message: {
          messageId: index,
          date: 1_800_000_000 + index,
          text: `prior ${index}`,
          sender: "Nick",
        },
      });
    }

    const openAIRequests: PromptTelegramOpenAIOptions[] = [];
    const sentMessages: SendTelegramMessageParams[] = [];

    const handle = startTelegramPolling({
      botToken: "token",
      adminChatIds: ["123"],
      timeoutSeconds: 1,
      limit: 100,
      coldPollIntervalMs: 10_000,
      activePollIntervalMs: 2_000,
      activePollWindowMs: 30_000,
      once: true,
      store,
      async getUpdates() {
        return {
          updates: [
            {
              update_id: 10,
              message: {
                message_id: 11,
                date: 1_800_000_011,
                chat: {
                  id: 123,
                  type: "private",
                  first_name: "Nick",
                },
                text: "drive forward a little",
              },
            },
            {
              update_id: 11,
              message: {
                message_id: 12,
                date: 1_800_000_012,
                chat: {
                  id: 123,
                  type: "private",
                  first_name: "Nick",
                },
                text: "then take a photo",
              },
            },
            {
              update_id: 12,
              message: {
                message_id: 13,
                date: 1_800_000_013,
                chat: {
                  id: 123,
                  type: "private",
                  first_name: "Nick",
                },
                text: "thanks",
              },
            },
          ],
        };
      },
      async respondToMessage(options) {
        openAIRequests.push(options);

        return {
          telegramMessage: "Driving forward and taking a photo.",
          spokenMessage: null,
          taskState: "Driving forward, then taking a photo.",
          isFinished: false,
          actions: [],
        };
      },
      async sendMessage(options) {
        sentMessages.push(options);

        return {
          messageId: 99,
        };
      },
    });

    await handle.done;

    expect(openAIRequests).toHaveLength(1);
    expect(openAIRequests[0]?.turnTrigger).toBe("telegram_messages");
    expect(openAIRequests[0]?.recentMessages).toHaveLength(10);
    expect(openAIRequests[0]?.newMessages).toEqual([
      {
        messageId: 11,
        date: 1_800_000_011,
        text: "drive forward a little",
        sender: "Nick",
      },
      {
        messageId: 12,
        date: 1_800_000_012,
        text: "then take a photo",
        sender: "Nick",
      },
      {
        messageId: 13,
        date: 1_800_000_013,
        text: "thanks",
        sender: "Nick",
      },
    ]);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      botToken: "token",
      chatId: "123",
      text: "Driving forward and taking a photo.",
    });
    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from({ length: 10 }, (_value, index) => {
        const messageId = index + 4;

        return {
          messageId,
          date: 1_800_000_000 + messageId,
          text:
            new Map([
              [11, "drive forward a little"],
              [12, "then take a photo"],
              [13, "thanks"],
            ]).get(messageId) ?? `prior ${messageId}`,
          sender: "Nick",
        };
      }),
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
