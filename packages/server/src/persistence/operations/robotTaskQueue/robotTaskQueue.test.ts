import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  abandonPendingRobotTaskWork,
  claimNextRobotTaskBatch,
  completeRobotTaskBatch,
  failRobotTaskBatch,
  readRobotTaskContext,
  recordRobotTaskBatchObservation,
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

    expect(
      await claimNextRobotTaskBatch({ nowMs: 6_000, store }),
    ).toBeUndefined();

    const after = await readRobotTaskContext({ chatId: "101", store });
    expect(after.session).toBeUndefined();
  });

  test("no-op sweep when nothing pending", async () => {
    const store = createMemoryDocumentStore();
    const sweep = await abandonPendingRobotTaskWork({ nowMs: 1_000, store });
    expect(sweep).toEqual({ abandonedBatchCount: 0, finishedSessionCount: 0 });
  });

  test("stores camera position with completed batch report", async () => {
    const store = createMemoryDocumentStore();

    await recordRobotTaskResponse({
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
    });

    const batch = expectDefined(
      await claimNextRobotTaskBatch({ nowMs: 2_000, store }),
    );

    const result = await completeRobotTaskBatch({
      batchId: batch.id,
      taskId: batch.taskId,
      photoPath: "/tmp/batch.jpg",
      cameraPosition: { pan: -10, tilt: 25 },
      steeringAngle: -5,
      nowMs: 3_000,
      store,
    });

    expect(result.batchReport.cameraPosition).toEqual({ pan: -10, tilt: 25 });
    expect(result.batchReport.steeringAngle).toBe(-5);
    expect(result.session.batchReports.at(-1)?.cameraPosition).toEqual({
      pan: -10,
      tilt: 25,
    });
    expect(result.session.batchReports.at(-1)?.steeringAngle).toBe(-5);
  });

  test("records a stored observation on a completed batch report", async () => {
    const store = createMemoryDocumentStore();

    await recordRobotTaskResponse({
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
    });

    const batch = expectDefined(
      await claimNextRobotTaskBatch({ nowMs: 2_000, store }),
    );

    await completeRobotTaskBatch({
      batchId: batch.id,
      taskId: batch.taskId,
      photoPath: "/tmp/batch.jpg",
      nowMs: 3_000,
      store,
    });

    const result = await recordRobotTaskBatchObservation({
      taskId: batch.taskId,
      batchId: batch.id,
      store,
      observation: {
        summary: "Window visible beyond a sofa.",
        targetProgress: "The requested window is visible.",
        navigableSpace: "Open floor remains ahead.",
        notableObjects: ["sofa in foreground"],
        viewQuality: "partial",
        recommendedNextMove: "Drive toward the visible window.",
      },
    });

    expect(result.session.batchReports.at(-1)?.photoObservation).toEqual({
      summary: "Window visible beyond a sofa.",
      targetProgress: "The requested window is visible.",
      navigableSpace: "Open floor remains ahead.",
      notableObjects: ["sofa in foreground"],
      viewQuality: "partial",
      recommendedNextMove: "Drive toward the visible window.",
    });
  });

  test("marks a failed claimed batch abandoned and keeps the task active", async () => {
    const store = createMemoryDocumentStore();

    await recordRobotTaskResponse({
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
    });

    const batch = expectDefined(
      await claimNextRobotTaskBatch({ nowMs: 2_000, store }),
    );
    const result = await failRobotTaskBatch({
      batchId: batch.id,
      taskId: batch.taskId,
      errorMessage: "camera process exited with code 1",
      nowMs: 3_000,
      store,
    });

    expect(result.changed).toBe(true);
    expect(result.batch.status).toBe("abandoned");
    expect(result.batch.abandonedAtMs).toBe(3_000);
    expect(result.session.status).toBe("active");
    expect(result.session.taskState).toContain("Robot worker failed batch");
    expect(result.session.taskState).toContain(
      "camera process exited with code 1",
    );
    expect(
      await claimNextRobotTaskBatch({ nowMs: 4_000, store }),
    ).toBeUndefined();

    const context = await readRobotTaskContext({ chatId: "101", store });
    expect(context.session?.status).toBe("active");
  });

  test("ignores late failure reports for completed batches", async () => {
    const store = createMemoryDocumentStore();

    await recordRobotTaskResponse({
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
    });

    const batch = expectDefined(
      await claimNextRobotTaskBatch({ nowMs: 2_000, store }),
    );
    await completeRobotTaskBatch({
      batchId: batch.id,
      taskId: batch.taskId,
      photoPath: "/tmp/batch.jpg",
      nowMs: 3_000,
      store,
    });

    const result = await failRobotTaskBatch({
      batchId: batch.id,
      taskId: batch.taskId,
      errorMessage: "response was lost",
      nowMs: 4_000,
      store,
    });

    expect(result.changed).toBe(false);
    expect(result.batch.status).toBe("completed");
    expect(result.session.taskState).not.toContain("response was lost");
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

function expectDefined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  return value as T;
}
