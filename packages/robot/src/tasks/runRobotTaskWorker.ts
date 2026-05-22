import { HerbertController } from "@herbert/robot/robot/HerbertController";
import {
  completeRobotActionBatch,
  pollRobotActionBatch,
} from "@herbert/robot/server/robotActionBatches";
import type { RobotTaskAction, RobotTaskActionBatch } from "@herbert/shared";
import pc from "picocolors";

export interface RobotTaskWorkerOptions {
  readonly mock: boolean;
  readonly pythonPath?: string;
  readonly safetyTimeoutMs: number;
  readonly serverUrl: string;
  readonly pollIntervalMs: number;
  readonly once: boolean;
}

export async function runRobotTaskWorker({
  mock,
  pythonPath,
  safetyTimeoutMs,
  serverUrl,
  pollIntervalMs,
  once,
}: RobotTaskWorkerOptions): Promise<void> {
  const robot = await HerbertController.create({
    mock,
    pythonPath,
    safetyTimeoutMs,
  });

  try {
    do {
      const batch = await pollRobotActionBatch({ serverUrl });

      if (batch === undefined) {
        if (once) {
          process.stdout.write(`${pc.dim("no queued robot actions")}\n`);
          return;
        }

        await sleep({ milliseconds: pollIntervalMs });
        continue;
      }

      process.stdout.write(
        `${pc.bold("batch")} ${formatKeyValue({
          key: "id",
          value: batch.id,
        })} ${formatKeyValue({
          key: "actions",
          value: String(batch.actions.length),
        })}\n`,
      );

      const photoPath = await executeBatch({ robot, batch, mock });
      await completeRobotActionBatch({
        serverUrl,
        batch,
        photoPath,
      });
      process.stdout.write(
        `${pc.bold("batch")} completed ${formatKeyValue({
          key: "id",
          value: batch.id,
        })}\n`,
      );
    } while (!once);
  } finally {
    await robot.stop();
    await robot.close();
  }
}

async function executeBatch({
  robot,
  batch,
  mock,
}: {
  readonly robot: HerbertController;
  readonly batch: RobotTaskActionBatch;
  readonly mock: boolean;
}): Promise<string> {
  let latestPhotoPath: string | undefined;

  for (const action of batch.actions) {
    process.stdout.write(`${pc.bold("action")} ${JSON.stringify(action)}\n`);
    latestPhotoPath = await executeAction({
      robot,
      action,
      latestPhotoPath,
      mock,
      batch,
    });
  }

  if (latestPhotoPath !== undefined) {
    return latestPhotoPath;
  }

  if (mock) {
    return await writeMockPhoto({ batch });
  }

  return (await robot.takePhoto()).path;
}

async function executeAction({
  robot,
  action,
  latestPhotoPath,
  mock,
  batch,
}: {
  readonly robot: HerbertController;
  readonly action: RobotTaskAction;
  readonly latestPhotoPath: string | undefined;
  readonly mock: boolean;
  readonly batch: RobotTaskActionBatch;
}): Promise<string | undefined> {
  if (action.type === "drive") {
    await robot.setMotor({
      speed: action.direction === "forward" ? action.speed : -action.speed,
    });
    await sleep({ milliseconds: action.durationMs });
    await robot.stop();
    return latestPhotoPath;
  }

  if (action.type === "drive_arc") {
    await robot.setSteering({ angle: action.angle });
    await robot.setMotor({
      speed: action.direction === "forward" ? action.speed : -action.speed,
    });
    await sleep({ milliseconds: action.durationMs });
    await robot.stop();
    await robot.setSteering({ angle: 0 });
    return latestPhotoPath;
  }

  if (action.type === "set_steering") {
    await robot.setSteering({ angle: action.angle });
    return latestPhotoPath;
  }

  if (action.type === "look") {
    await robot.moveCamera({
      panDelta: action.panDelta,
      tiltDelta: action.tiltDelta,
    });
    return latestPhotoPath;
  }

  if (action.type === "take_photo") {
    if (mock) {
      return await writeMockPhoto({ batch });
    }

    return (await robot.takePhoto()).path;
  }

  await robot.stop();
  return latestPhotoPath;
}

async function writeMockPhoto({
  batch,
}: {
  readonly batch: RobotTaskActionBatch;
}): Promise<string> {
  const path = `/tmp/herbert-${batch.id}.png`;
  await Bun.write(path, Buffer.from(mockPngBase64, "base64"));
  return path;
}

const mockPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function sleep({
  milliseconds,
}: {
  readonly milliseconds: number;
}): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatKeyValue({
  key,
  value,
}: {
  readonly key: string;
  readonly value: string;
}): string {
  return `${pc.dim(`${key}=`)}${value}`;
}
