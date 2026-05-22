import {
  executeRobotTaskBatch,
  type RobotTaskExecutor,
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
            speed: 20,
            durationMs: 100,
          },
        ],
      },
    });

    expect(photoPath).toBe("/tmp/herbert-batch.jpg");
    expect(calls).toEqual([
      "set_steering:0",
      "set_motor:20",
      "stop",
      "take_photo",
    ]);
  });

  test("tilts the camera fully up before the first batch in a task session", async () => {
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
    expect(calls).toEqual(["set_camera_tilt:35", "take_photo"]);
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
});

function createFakeRobot({
  calls,
}: {
  readonly calls: string[];
}): RobotTaskExecutor {
  return {
    async setMotor({ speed }) {
      calls.push(`set_motor:${speed}`);
    },
    async setSteering({ angle }) {
      calls.push(`set_steering:${angle}`);
    },
    async moveCamera({ panDelta, tiltDelta }) {
      calls.push(`move_camera:${panDelta}:${tiltDelta}`);
    },
    async setCameraTilt({ angle }) {
      calls.push(`set_camera_tilt:${angle}`);
    },
    async takePhoto() {
      calls.push("take_photo");
      return { path: "/tmp/herbert-batch.jpg" };
    },
    async stop() {
      calls.push("stop");
    },
  };
}
