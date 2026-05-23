import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  appendHerbertResponseHistory,
  filterRecentHerbertResponses,
  readHerbertResponseHistory,
} from "@herbert/server/persistence/operations/herbertResponseHistory";
import { describe, expect, test } from "bun:test";

describe("herbertResponseHistory operations", () => {
  test("stores recent Telegram and spoken response text per chat", async () => {
    const store = createMemoryDocumentStore();

    await appendHerbertResponseHistory({
      chatId: "123",
      nowMs: 1_000,
      store,
      response: {
        telegramMessage: "Heading over.",
        spokenMessage: "Right then, tiny expedition underway.",
      },
    });
    await appendHerbertResponseHistory({
      chatId: "456",
      nowMs: 2_000,
      store,
      response: {
        telegramMessage: null,
        spokenMessage: "Different chat, different room.",
      },
    });

    expect(await readHerbertResponseHistory({ chatId: "123", store })).toEqual([
      {
        createdAtMs: 1_000,
        telegramMessage: "Heading over.",
        spokenMessage: "Right then, tiny expedition underway.",
      },
    ]);
    expect(await readHerbertResponseHistory({ chatId: "456", store })).toEqual([
      {
        createdAtMs: 2_000,
        telegramMessage: null,
        spokenMessage: "Different chat, different room.",
      },
    ]);
  });

  test("skips action-only responses", async () => {
    const store = createMemoryDocumentStore();

    await appendHerbertResponseHistory({
      chatId: "123",
      nowMs: 1_000,
      store,
      response: {
        telegramMessage: null,
        spokenMessage: null,
      },
    });

    expect(await readHerbertResponseHistory({ chatId: "123", store })).toEqual(
      [],
    );
  });

  test("filterRecentHerbertResponses drops responses older than the cutoff", () => {
    expect(
      filterRecentHerbertResponses({
        nowMs: 600_000,
        maxAgeMs: 180_000,
        responses: [
          {
            createdAtMs: 100_000,
            telegramMessage: "way old",
            spokenMessage: null,
          },
          {
            createdAtMs: 500_000,
            telegramMessage: null,
            spokenMessage: "fresh enough",
          },
          {
            createdAtMs: 350_000,
            telegramMessage: "older than cutoff",
            spokenMessage: null,
          },
          {
            createdAtMs: 580_000,
            telegramMessage: "fresh",
            spokenMessage: "also fresh",
          },
        ],
      }),
    ).toEqual([
      {
        createdAtMs: 500_000,
        telegramMessage: null,
        spokenMessage: "fresh enough",
      },
      {
        createdAtMs: 580_000,
        telegramMessage: "fresh",
        spokenMessage: "also fresh",
      },
    ]);
  });

  test("filterRecentHerbertResponses can drop responses before an active task", () => {
    expect(
      filterRecentHerbertResponses({
        nowMs: 600_000,
        maxAgeMs: 180_000,
        sinceMs: 520_000,
        responses: [
          {
            createdAtMs: 500_000,
            telegramMessage: "previous task result",
            spokenMessage: null,
          },
          {
            createdAtMs: 540_000,
            telegramMessage: "current task progress",
            spokenMessage: "Still moving.",
          },
        ],
      }),
    ).toEqual([
      {
        createdAtMs: 540_000,
        telegramMessage: "current task progress",
        spokenMessage: "Still moving.",
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
