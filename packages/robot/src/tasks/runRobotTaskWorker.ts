import { HerbertController } from "@herbert/robot/robot/HerbertController";
import {
  completeRobotActionBatch,
  pollRobotActionBatch,
} from "@herbert/robot/server/robotActionBatches";
import {
  cameraAngleLimits,
  type RobotTaskAction,
  type RobotTaskActionBatch,
} from "@herbert/shared";
import pc from "picocolors";

export interface RobotTaskWorkerOptions {
  readonly mock: boolean;
  readonly pythonPath?: string;
  readonly safetyTimeoutMs: number;
  readonly serverUrl: string;
  readonly pollIntervalMs: number;
  readonly once: boolean;
}

export interface RobotTaskExecutor {
  readonly setMotor: (options: { readonly speed: number }) => Promise<unknown>;
  readonly setSteering: (options: {
    readonly angle: number;
  }) => Promise<unknown>;
  readonly moveCamera: (options: {
    readonly panDelta: number;
    readonly tiltDelta: number;
  }) => Promise<unknown>;
  readonly setCameraTilt: (options: {
    readonly angle: number;
  }) => Promise<unknown>;
  readonly getSteeringAngle: () => number;
  readonly takePhoto: () => Promise<{ readonly path: string }>;
  readonly stop: () => Promise<unknown>;
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
    const initializedTaskSessionIds = new Set<string>();

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

      const initializeTaskSessionCamera = !initializedTaskSessionIds.has(
        batch.taskId,
      );
      initializedTaskSessionIds.add(batch.taskId);

      const photoPath = await executeRobotTaskBatch({
        robot,
        batch,
        mock,
        initializeTaskSessionCamera,
      });
      const distanceCm = await readDistanceCm({ robot, mock });
      await completeRobotActionBatch({
        serverUrl,
        batch,
        photoPath,
        cameraPosition: robot.getCameraPosition(),
        steeringAngle: robot.getSteeringAngle(),
        distanceCm,
      });
      process.stdout.write(
        `${pc.bold("batch")} completed ${formatKeyValue({
          key: "id",
          value: batch.id,
        })}\n`,
      );
    } while (!once);
  } finally {
    try {
      await robot.stop();
    } catch (error) {
      process.stderr.write(
        `${pc.red(pc.bold("robot"))} cleanup stop failed: ${formatError(error)}\n`,
      );
    }

    await robot.close();
  }
}

export async function executeRobotTaskBatch({
  robot,
  batch,
  mock,
  initializeTaskSessionCamera = false,
}: {
  readonly robot: RobotTaskExecutor;
  readonly batch: RobotTaskActionBatch;
  readonly mock: boolean;
  readonly initializeTaskSessionCamera?: boolean;
}): Promise<string> {
  let latestPhotoPath: string | undefined;

  if (initializeTaskSessionCamera) {
    await robot.setSteering({ angle: 0 });
    await robot.setCameraTilt({ angle: cameraAngleLimits.max });
  }

  for (const action of batch.actions) {
    process.stdout.write(`${pc.bold("action")} ${JSON.stringify(action)}\n`);
    latestPhotoPath = await executeAction({
      robot,
      action,
      latestPhotoPath,
      mock,
      batch,
    });

    if (latestPhotoPath !== undefined && actionInvalidatesPhoto({ action })) {
      latestPhotoPath = undefined;
    }
  }

  if (latestPhotoPath !== undefined) {
    return latestPhotoPath;
  }

  if (mock) {
    return await writeMockPhoto({ batch });
  }

  return (await robot.takePhoto()).path;
}

function actionInvalidatesPhoto({
  action,
}: {
  readonly action: RobotTaskAction;
}): boolean {
  return (
    action.type === "drive" ||
    action.type === "drive_arc" ||
    action.type === "look"
  );
}

async function executeAction({
  robot,
  action,
  latestPhotoPath,
  mock,
  batch,
}: {
  readonly robot: RobotTaskExecutor;
  readonly action: RobotTaskAction;
  readonly latestPhotoPath: string | undefined;
  readonly mock: boolean;
  readonly batch: RobotTaskActionBatch;
}): Promise<string | undefined> {
  if (action.type === "drive") {
    await robot.setSteering({ angle: 0 });
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

async function readDistanceCm({
  robot,
  mock,
}: {
  readonly robot: HerbertController;
  readonly mock: boolean;
}): Promise<number | null> {
  if (mock) {
    return null;
  }

  try {
    const result = await robot.getDistance();
    return result.distanceCm;
  } catch (error) {
    process.stderr.write(
      `${pc.yellow("distance")} read failed: ${formatError(error)}\n`,
    );
    return null;
  }
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

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
