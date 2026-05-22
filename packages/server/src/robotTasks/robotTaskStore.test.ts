import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  claimNextRobotTaskBatch,
  recordRobotTaskResponse,
} from "@herbert/server/robotTasks/robotTaskStore";
import { describe, expect, test } from "bun:test";

describe("robotTaskStore", () => {
  test("serializes concurrent queue updates for the same active task", async () => {
    const store = createMemoryDocumentStore();

    await Promise.all([
      recordRobotTaskResponse({
        chatId: "101",
        nowMs: 1_000,
        store,
        response: {
          telegramMessage: null,
          spokenMessage: null,
          taskState: "Need an initial look.",
          isFinished: false,
          actions: [{ type: "take_photo" }],
        },
      }),
      recordRobotTaskResponse({
        chatId: "101",
        nowMs: 1_001,
        store,
        response: {
          telegramMessage: null,
          spokenMessage: null,
          taskState: "Need to look left after the initial photo.",
          isFinished: false,
          actions: [{ type: "look", panDelta: -10, tiltDelta: 0 }],
        },
      }),
    ]);

    const firstBatch = await claimNextRobotTaskBatch({ nowMs: 2_000, store });
    const secondBatch = await claimNextRobotTaskBatch({ nowMs: 2_001, store });
    const thirdBatch = await claimNextRobotTaskBatch({ nowMs: 2_002, store });

    expect(firstBatch?.taskId).toBeDefined();
    expect(secondBatch?.taskId).toBe(firstBatch?.taskId);
    expect(firstBatch?.actions).toEqual([{ type: "take_photo" }]);
    expect(secondBatch?.actions).toEqual([
      { type: "look", panDelta: -10, tiltDelta: 0 },
    ]);
    expect(thirdBatch).toBeUndefined();
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
