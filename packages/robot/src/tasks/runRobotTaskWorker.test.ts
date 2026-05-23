import {
  executeRobotTaskBatch,
  processRobotTaskBatch,
  type RobotTaskExecutor,
  runRobotTaskWorkerLoop,
} from "@herbert/robot/tasks/runRobotTaskWorker";
import { describe, expect, test } from "bun:test";

describe("executeRobotTaskBatch", () => {
  test("centers steering before straight drive actions", async () => {
    const calls: string[] = [];
    const robot = createFakeRobot({ calls });
    const photoPath = await executeRobotTaskBatch({
      robot,
      mock: false,
      batch: {
        id: "batch-1",
        taskId: "task-1",
        actions: [
          {
            type: "drive",
            direction: "forward",
            speed: 70,
            durationMs: 1_000,
          },
        ],
      },
    });

    expect(photoPath).toBe("/tmp/herbert-batch.jpg");
    expect(calls).toEqual([
      "set_steering:0",
      "set_motor:70",
      "stop",
      "take_photo",
    ]);
  });

  test("centers steering and tilts the camera fully up before the first batch in a task session", async () => {
    const calls: string[] = [];
    const robot = createFakeRobot({ calls });
    const photoPath = await executeRobotTaskBatch({
      robot,
      mock: false,
      initializeTaskSessionCamera: true,
      batch: {
        id: "batch-1",
        taskId: "task-1",
        actions: [{ type: "take_photo" }],
      },
    });

    expect(photoPath).toBe("/tmp/herbert-batch.jpg");
    expect(calls).toEqual([
      "set_steering:0",
      "set_camera_tilt:35",
      "take_photo",
    ]);
  });

  test("captures a fresh completion photo after camera movement", async () => {
    const calls: string[] = [];
    const robot = createFakeRobot({ calls });
    await executeRobotTaskBatch({
      robot,
      mock: false,
      batch: {
        id: "batch-1",
        taskId: "task-1",
        actions: [
          { type: "take_photo" },
          { type: "look", panDelta: -10, tiltDelta: 0 },
        ],
      },
    });

    expect(calls).toEqual(["take_photo", "move_camera:-10:0", "take_photo"]);
  });

  test("reports failed batches and resolves instead of throwing", async () => {
    const calls: string[] = [];
    const failures: Array<{
      readonly batchId: string;
      readonly errorMessage: string;
    }> = [];
    const robot = createFakeRobot({
      calls,
      failTakePhoto: new Error("camera process exited with code 1"),
    });
    const batch = {
      id: "batch-1",
      taskId: "task-1",
      actions: [{ type: "take_photo" as const }],
    };

    const result = await processRobotTaskBatch({
      robot,
      batch,
      mock: false,
      serverUrl: "http://server.test",
      async failActionBatch({ batch: failedBatch, errorMessage }) {
        failures.push({
          batchId: failedBatch.id,
          errorMessage,
        });
        return { ok: true, accepted: true };
      },
      async completeActionBatch() {
        throw new Error("should not complete failed batch");
      },
    });

    expect(result.completed).toBe(false);
    expect(calls).toEqual(["take_photo", "stop"]);
    expect(failures).toEqual([
      {
        batchId: "batch-1",
        errorMessage: "camera process exited with code 1",
      },
    ]);
  });

  test("continues polling after a transient poll error", async () => {
    const calls: string[] = [];
    const completed: string[] = [];
    const robot = createFakeRobot({ calls });
    let pollCount = 0;

    await runRobotTaskWorkerLoop({
      robot,
      mock: false,
      serverUrl: "http://server.test",
      pollIntervalMs: 0,
      once: false,
      async pollActionBatch() {
        pollCount += 1;

        if (pollCount === 1) {
          throw new Error("server temporarily unavailable");
        }

        if (pollCount === 2) {
          return {
            id: "batch-1",
            taskId: "task-1",
            actions: [{ type: "take_photo" }],
          };
        }

        return undefined;
      },
      async completeActionBatch({ batch }) {
        completed.push(batch.id);
        return { ok: true, accepted: true };
      },
      async failActionBatch() {
        throw new Error("should not fail successful batch");
      },
      shouldContinue: () => pollCount < 3,
    });

    expect(pollCount).toBe(3);
    expect(completed).toEqual(["batch-1"]);
    expect(calls).toEqual([
      "set_steering:0",
      "set_camera_tilt:35",
      "take_photo",
      "get_distance",
    ]);
  });
});

function createFakeRobot({
  calls,
  failTakePhoto,
}: {
  readonly calls: string[];
  readonly failTakePhoto?: Error;
}): RobotTaskExecutor {
  return {
    async setMotor({ speed }) {
      calls.push(`set_motor:${speed}`);
    },
    async setSteering({ angle }) {
      calls.push(`set_steering:${angle}`);
    },
    getSteeringAngle() {
      return 0;
    },
    async moveCamera({ panDelta, tiltDelta }) {
      calls.push(`move_camera:${panDelta}:${tiltDelta}`);
    },
    async setCameraTilt({ angle }) {
      calls.push(`set_camera_tilt:${angle}`);
    },
    getCameraPosition() {
      return { pan: -10, tilt: 25 };
    },
    async takePhoto() {
      calls.push("take_photo");
      if (failTakePhoto !== undefined) {
        throw failTakePhoto;
      }
      return { path: "/tmp/herbert-batch.jpg" };
    },
    async getDistance() {
      calls.push("get_distance");
      return { distanceCm: 42 };
    },
    async stop() {
      calls.push("stop");
    },
  };
}
