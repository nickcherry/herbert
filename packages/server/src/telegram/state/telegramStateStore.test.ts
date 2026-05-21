import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  readTelegramState,
  writeTelegramState,
} from "@herbert/server/telegram/state/telegramStateStore";
import { describe, expect, test } from "bun:test";

describe("telegramStateStore", () => {
  test("uses the server document store for cursor state", async () => {
    const store = createMemoryDocumentStore();

    await writeTelegramState({
      store,
      state: {
        nextUpdateOffset: 42,
        lastReceivedAtMs: 1000,
      },
    });

    const state = await readTelegramState({ store });

    expect(state).toEqual({
      nextUpdateOffset: 42,
      lastReceivedAtMs: 1000,
    });
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
