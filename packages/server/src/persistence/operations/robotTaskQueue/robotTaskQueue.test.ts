import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  abandonPendingRobotTaskWork,
  claimNextRobotTaskBatch,
  readRobotTaskContext,
  recordRobotTaskResponse,
} from "@herbert/server/persistence/operations/robotTaskQueue";
import { describe, expect, test } from "bun:test";

describe("robotTaskQueue operations", () => {
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

  test("abandons pending batches and finishes active sessions on startup sweep", async () => {
    const store = createMemoryDocumentStore();

    await recordRobotTaskResponse({
      chatId: "101",
      nowMs: 1_000,
      store,
      response: {
        telegramMessage: null,
        spokenMessage: null,
        taskState: "Mid-task, needs a look.",
        isFinished: false,
        actions: [{ type: "take_photo" }],
      },
    });

    const before = await readRobotTaskContext({ chatId: "101", store });
    expect(before.session?.status).toBe("active");

    const sweep = await abandonPendingRobotTaskWork({ nowMs: 5_000, store });
    expect(sweep.abandonedBatchCount).toBe(1);
    expect(sweep.finishedSessionCount).toBe(1);

    expect(await claimNextRobotTaskBatch({ nowMs: 6_000, store })).toBeUndefined();

    const after = await readRobotTaskContext({ chatId: "101", store });
    expect(after.session).toBeUndefined();
  });

  test("no-op sweep when nothing pending", async () => {
    const store = createMemoryDocumentStore();
    const sweep = await abandonPendingRobotTaskWork({ nowMs: 1_000, store });
    expect(sweep).toEqual({ abandonedBatchCount: 0, finishedSessionCount: 0 });
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
