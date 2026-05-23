import { HerbertController } from "@herbert/robot/robot/HerbertController";
import {
  completeRobotActionBatch,
  failRobotActionBatch,
  pollRobotActionBatch,
} from "@herbert/robot/server/robotActionBatches";
import {
  cameraAngleLimits,
  type RobotTaskAction,
  type RobotTaskActionBatch,
  type RobotTaskCameraPosition,
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
  readonly getCameraPosition: () => RobotTaskCameraPosition;
  readonly getSteeringAngle: () => number;
  readonly getDistance: () => Promise<{
    readonly distanceCm: number | null;
  }>;
  readonly takePhoto: () => Promise<{ readonly path: string }>;
  readonly stop: () => Promise<unknown>;
}

type PollRobotActionBatch = typeof pollRobotActionBatch;
type CompleteRobotActionBatch = typeof completeRobotActionBatch;
type FailRobotActionBatch = typeof failRobotActionBatch;

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
    await runRobotTaskWorkerLoop({
      robot,
      mock,
      serverUrl,
      pollIntervalMs,
      once,
    });
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

export async function runRobotTaskWorkerLoop({
  robot,
  mock,
  serverUrl,
  pollIntervalMs,
  once,
  pollActionBatch = pollRobotActionBatch,
  completeActionBatch = completeRobotActionBatch,
  failActionBatch = failRobotActionBatch,
  shouldContinue = () => true,
}: {
  readonly robot: RobotTaskExecutor;
  readonly mock: boolean;
  readonly serverUrl: string;
  readonly pollIntervalMs: number;
  readonly once: boolean;
  readonly pollActionBatch?: PollRobotActionBatch;
  readonly completeActionBatch?: CompleteRobotActionBatch;
  readonly failActionBatch?: FailRobotActionBatch;
  readonly shouldContinue?: () => boolean;
}): Promise<void> {
  const initializedTaskSessionIds = new Set<string>();

  do {
    let batch: RobotTaskActionBatch | undefined;

    try {
      batch = await pollActionBatch({ serverUrl });
    } catch (error) {
      process.stderr.write(
        `${pc.red(pc.bold("worker"))} poll failed: ${formatError(error)}\n`,
      );

      if (once) {
        return;
      }

      await sleep({ milliseconds: pollIntervalMs });
      continue;
    }

    if (batch === undefined) {
      if (once) {
        process.stdout.write(`${pc.dim("no queued robot actions")}\n`);
        return;
      }

      await sleep({ milliseconds: pollIntervalMs });
      continue;
    }

    const initializeTaskSessionCamera = !initializedTaskSessionIds.has(
      batch.taskId,
    );
    initializedTaskSessionIds.add(batch.taskId);

    const result = await processRobotTaskBatch({
      robot,
      batch,
      mock,
      serverUrl,
      initializeTaskSessionCamera,
      completeActionBatch,
      failActionBatch,
    });

    if (!result.completed) {
      initializedTaskSessionIds.delete(batch.taskId);
    }
  } while (!once && shouldContinue());
}

export async function processRobotTaskBatch({
  robot,
  batch,
  mock,
  serverUrl,
  initializeTaskSessionCamera = false,
  completeActionBatch = completeRobotActionBatch,
  failActionBatch = failRobotActionBatch,
}: {
  readonly robot: RobotTaskExecutor;
  readonly batch: RobotTaskActionBatch;
  readonly mock: boolean;
  readonly serverUrl: string;
  readonly initializeTaskSessionCamera?: boolean;
  readonly completeActionBatch?: CompleteRobotActionBatch;
  readonly failActionBatch?: FailRobotActionBatch;
}): Promise<{ readonly completed: boolean }> {
  process.stdout.write(
    `${pc.bold("batch")} ${formatKeyValue({
      key: "id",
      value: batch.id,
    })} ${formatKeyValue({
      key: "actions",
      value: String(batch.actions.length),
    })}\n`,
  );

  try {
    const photoPath = await executeRobotTaskBatch({
      robot,
      batch,
      mock,
      initializeTaskSessionCamera,
    });
    const distanceCm = await readDistanceCm({ robot, mock });
    await completeActionBatch({
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
    return { completed: true };
  } catch (error) {
    const message = formatError(error);
    process.stderr.write(
      `${pc.red(pc.bold("batch"))} failed ${formatKeyValue({
        key: "id",
        value: batch.id,
      })}: ${message}\n`,
    );

    await stopAfterBatchFailure({ robot });
    await reportBatchFailure({
      batch,
      errorMessage: message,
      failActionBatch,
      serverUrl,
    });
    return { completed: false };
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
  readonly robot: Pick<RobotTaskExecutor, "getDistance">;
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

async function stopAfterBatchFailure({
  robot,
}: {
  readonly robot: Pick<RobotTaskExecutor, "stop">;
}): Promise<void> {
  try {
    await robot.stop();
  } catch (error) {
    process.stderr.write(
      `${pc.red(pc.bold("robot"))} stop after batch failure failed: ${formatError(error)}\n`,
    );
  }
}

async function reportBatchFailure({
  batch,
  errorMessage,
  failActionBatch,
  serverUrl,
}: {
  readonly batch: RobotTaskActionBatch;
  readonly errorMessage: string;
  readonly failActionBatch: FailRobotActionBatch;
  readonly serverUrl: string;
}): Promise<void> {
  try {
    await failActionBatch({
      serverUrl,
      batch,
      errorMessage,
    });
  } catch (error) {
    process.stderr.write(
      `${pc.red(pc.bold("batch"))} failure report failed ${formatKeyValue({
        key: "id",
        value: batch.id,
      })}: ${formatError(error)}\n`,
    );
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
