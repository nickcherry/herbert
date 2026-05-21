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
  test("sends authorized admin messages with recent context to OpenAI", async () => {
    const store = createMemoryDocumentStore();

    for (let index = 1; index <= 10; index += 1) {
      await appendTelegramMessageHistory({
        chatId: "123",
        store,
        message: {
          messageId: index,
          date: 1_800_000_000 + index,
          text: `prior ${index}`,
        },
      });
    }

    let openAIRequest: PromptTelegramOpenAIOptions | undefined;
    let sentMessage: SendTelegramMessageParams | undefined;

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
                },
                text: "drive forward a little",
              },
            },
          ],
        };
      },
      async respondToMessage(options) {
        openAIRequest = options;

        return {
          message: "Driving forward.",
          actions: [],
        };
      },
      async sendMessage(options) {
        sentMessage = options;

        return {
          messageId: 99,
        };
      },
    });

    await handle.done;

    expect(requireDefined(openAIRequest).recentMessages).toHaveLength(10);
    expect(requireDefined(openAIRequest).currentMessage).toEqual({
      messageId: 11,
      date: 1_800_000_011,
      text: "drive forward a little",
    });
    expect(requireDefined(sentMessage)).toMatchObject({
      botToken: "token",
      chatId: "123",
      text: "Driving forward.",
    });
    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from({ length: 10 }, (_value, index) => {
        const messageId = index + 2;

        return {
          messageId,
          date: 1_800_000_000 + messageId,
          text:
            messageId === 11 ? "drive forward a little" : `prior ${messageId}`,
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

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected value to be defined.");
  }

  return value;
}
