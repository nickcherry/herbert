import { telegramConfig } from "@herbert/server/constants/telegram";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  appendHerbertResponseHistory,
  readHerbertResponseHistory,
} from "@herbert/server/persistence/operations/herbertResponseHistory";
import {
  appendTelegramMessageHistory,
  readTelegramMessageHistory,
} from "@herbert/server/persistence/operations/telegramMessageHistory";
import type { PromptTelegramOpenAIOptions } from "@herbert/server/telegram/promptTelegramOpenAI";
import {
  pollIntervalForState,
  startTelegramPolling,
} from "@herbert/server/telegram/runTelegramMonitor";
import type { SendTelegramMessageParams } from "@herbert/server/telegram/sendTelegramMessage";
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

    for (
      let index = 1;
      index <= telegramConfig.openAIContextMessageLimit;
      index += 1
    ) {
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
    await appendHerbertResponseHistory({
      chatId: "123",
      nowMs: Date.now(),
      store,
      response: {
        telegramMessage: "I am near the desk.",
        spokenMessage: "Desk-adjacent, as they say.",
      },
    });

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
                message_id: telegramConfig.openAIContextMessageLimit + 1,
                date:
                  1_800_000_000 + telegramConfig.openAIContextMessageLimit + 1,
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
                message_id: telegramConfig.openAIContextMessageLimit + 2,
                date:
                  1_800_000_000 + telegramConfig.openAIContextMessageLimit + 2,
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
                message_id: telegramConfig.openAIContextMessageLimit + 3,
                date:
                  1_800_000_000 + telegramConfig.openAIContextMessageLimit + 3,
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
    expect(openAIRequests[0]?.recentMessages).toHaveLength(
      telegramConfig.openAIContextMessageLimit,
    );
    expect(openAIRequests[0]?.recentHerbertResponses).toEqual([
      {
        createdAtMs: expect.any(Number),
        telegramMessage: "I am near the desk.",
        spokenMessage: "Desk-adjacent, as they say.",
      },
    ]);
    expect(openAIRequests[0]?.newMessages).toEqual([
      {
        messageId: telegramConfig.openAIContextMessageLimit + 1,
        date: 1_800_000_000 + telegramConfig.openAIContextMessageLimit + 1,
        text: "drive forward a little",
        sender: "Nick",
      },
      {
        messageId: telegramConfig.openAIContextMessageLimit + 2,
        date: 1_800_000_000 + telegramConfig.openAIContextMessageLimit + 2,
        text: "then take a photo",
        sender: "Nick",
      },
      {
        messageId: telegramConfig.openAIContextMessageLimit + 3,
        date: 1_800_000_000 + telegramConfig.openAIContextMessageLimit + 3,
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
    expect(await readHerbertResponseHistory({ chatId: "123", store })).toEqual([
      {
        createdAtMs: expect.any(Number),
        telegramMessage: "I am near the desk.",
        spokenMessage: "Desk-adjacent, as they say.",
      },
      {
        createdAtMs: expect.any(Number),
        telegramMessage: "Driving forward and taking a photo.",
        spokenMessage: null,
      },
    ]);
    expect(await readTelegramMessageHistory({ chatId: "123", store })).toEqual(
      Array.from(
        { length: telegramConfig.openAIContextMessageLimit },
        (_value, index) => {
          const messageId = index + 4;

          return {
            messageId,
            date: 1_800_000_000 + messageId,
            text:
              new Map([
                [
                  telegramConfig.openAIContextMessageLimit + 1,
                  "drive forward a little",
                ],
                [
                  telegramConfig.openAIContextMessageLimit + 2,
                  "then take a photo",
                ],
                [telegramConfig.openAIContextMessageLimit + 3, "thanks"],
              ]).get(messageId) ?? `prior ${messageId}`,
            sender: "Nick",
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
