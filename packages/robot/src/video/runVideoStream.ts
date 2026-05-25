import { clamp } from "@herbert/robot/robot/clamp";
import { HerbertController } from "@herbert/robot/robot/HerbertController";
import { pollRobotControlCommand } from "@herbert/robot/server/pollRobotControlCommand";
import { uploadRobotVideoFrame } from "@herbert/robot/server/uploadRobotVideoFrame";
import {
  cameraAngleLimits,
  type RemoteControlQueuedCommand,
  steeringAngleLimits,
  videoFrameHeightSchema,
  videoFrameWidthSchema,
} from "@herbert/shared";
import pc from "picocolors";
import { z } from "zod";

export interface VideoStreamOptions {
  readonly mock: boolean;
  readonly pythonPath?: string;
  readonly safetyTimeoutMs: number;
  readonly serverUrl: string;
  readonly fps: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly once: boolean;
}

export async function runVideoStream(
  options: VideoStreamOptions,
): Promise<void> {
  const fps = videoFpsSchema.parse(options.fps);
  const frameWidth = videoFrameWidthSchema.parse(options.frameWidth);
  const frameHeight = videoFrameHeightSchema.parse(options.frameHeight);
  const frameIntervalMs = Math.round(1000 / fps);
  const robot = await HerbertController.create({
    mock: options.mock,
    pythonPath: options.pythonPath,
    safetyTimeoutMs: options.safetyTimeoutMs,
  });

  let stopping = false;
  let frameCount = 0;
  let lastStatusAtMs = 0;
  let robotTaskChain = Promise.resolve();

  const stop = (): void => {
    stopping = true;
  };

  const runRobotTask = async <T>(task: () => Promise<T>): Promise<T> => {
    const result = robotTaskChain.then(task, task);
    robotTaskChain = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  };

  try {
    const detail = await runRobotTask(async () => {
      return await centerRobotPose({ robot });
    });
    process.stdout.write(`${pc.bold("control")} ${detail}\n`);
  } catch (error) {
    process.stderr.write(
      `${pc.red(pc.bold("control"))} ${formatError(error)}\n`,
    );
  }

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  process.stdout.write(
    `${pc.bold("video")} streaming ${frameWidth}x${frameHeight} at ${fps} fps to ${options.serverUrl}\n`,
  );

  const controlLoop = options.once
    ? Promise.resolve()
    : runControlLoop({
        robot,
        serverUrl: options.serverUrl,
        isStopping: () => stopping,
        runRobotTask,
      });

  try {
    while (!stopping) {
      const loopStartedAtMs = Date.now();

      try {
        const frame = await runRobotTask(async () => {
          return await robot.captureFrame({
            width: frameWidth,
            height: frameHeight,
          });
        });
        const image = Buffer.from(frame.imageBase64, "base64");
        const upload = await uploadRobotVideoFrame({
          serverUrl: options.serverUrl,
          image,
          contentType: frame.contentType,
          capturedAtMs: frame.capturedAtMs,
          width: frame.width,
          height: frame.height,
        });

        frameCount += 1;
        if (
          options.once ||
          frameCount === 1 ||
          loopStartedAtMs - lastStatusAtMs >= 1_000
        ) {
          lastStatusAtMs = loopStartedAtMs;
          process.stdout.write(
            `${pc.bold("video")} frame=${upload.frameId} bytes=${image.byteLength} viewers=${upload.subscriberCount}\n`,
          );
        }
      } catch (error) {
        process.stderr.write(
          `${pc.red(pc.bold("video"))} ${formatError(error)}\n`,
        );
      }

      if (options.once) {
        break;
      }

      const elapsedMs = Date.now() - loopStartedAtMs;
      await sleep(Math.max(0, frameIntervalMs - elapsedMs));
    }
  } finally {
    stopping = true;
    await controlLoop;
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await robot.close();
  }
}

async function runControlLoop({
  robot,
  serverUrl,
  isStopping,
  runRobotTask,
}: {
  readonly robot: HerbertController;
  readonly serverUrl: string;
  readonly isStopping: () => boolean;
  readonly runRobotTask: <T>(task: () => Promise<T>) => Promise<T>;
}): Promise<void> {
  let lastErrorAtMs = 0;

  process.stdout.write(`${pc.bold("control")} polling ${serverUrl}\n`);

  while (!isStopping()) {
    try {
      const command = await pollRobotControlCommand({ serverUrl });

      if (isStopping()) {
        break;
      }

      if (command === null) {
        await sleep(controlPollIntervalMs);
        continue;
      }

      const detail = await runRobotTask(async () => {
        return await executeRemoteControlCommand({ robot, command });
      });
      process.stdout.write(`${pc.bold("control")} ${detail}\n`);
    } catch (error) {
      const now = Date.now();

      if (now - lastErrorAtMs >= controlErrorLogIntervalMs) {
        lastErrorAtMs = now;
        process.stderr.write(
          `${pc.red(pc.bold("control"))} ${formatError(error)}\n`,
        );
      }

      await sleep(controlPollIntervalMs);
    }
  }
}

async function executeRemoteControlCommand({
  robot,
  command,
}: {
  readonly robot: HerbertController;
  readonly command: RemoteControlQueuedCommand;
}): Promise<string> {
  if (command.type === "drive") {
    const speed =
      command.direction === "forward" ? command.speed : -command.speed;
    await robot.setMotor({ speed });
    await sleep(command.durationMs);
    await robot.stop();
    return `${command.direction} speed=${command.speed} pulse=${command.durationMs}ms`;
  }

  if (command.type === "steer") {
    const targetAngle = clamp({
      value: robot.getSteeringAngle() + command.delta,
      min: steeringAngleLimits.min,
      max: steeringAngleLimits.max,
    });
    await robot.setSteering({ angle: targetAngle });
    return `steer delta=${command.delta} angle=${targetAngle}`;
  }

  if (command.type === "camera") {
    const cameraPosition = robot.getCameraPosition();
    const targetAngle = clamp({
      value: cameraPosition[command.axis] + command.delta,
      min: cameraAngleLimits.min,
      max: cameraAngleLimits.max,
    });

    if (command.axis === "pan") {
      await robot.setCameraPan({ angle: targetAngle });
    } else {
      await robot.setCameraTilt({ angle: targetAngle });
    }

    return `camera ${command.axis} delta=${command.delta} angle=${targetAngle}`;
  }

  if (command.type === "center") {
    return await centerRobotPose({ robot });
  }

  await robot.stop();
  await robot.setSteering({ angle: 0 });
  return "stop motors, steering centered";
}

async function centerRobotPose({
  robot,
}: {
  readonly robot: HerbertController;
}): Promise<string> {
  await robot.stop();
  await robot.setSteering({ angle: 0 });
  await robot.setCameraPan({ angle: 0 });
  await robot.setCameraTilt({ angle: cameraAngleLimits.max });
  return `center motors stopped, wheels=0, camera pan=0 tilt=${cameraAngleLimits.max}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const videoFpsSchema = z.number().min(0.2).max(10);
const controlPollIntervalMs = 100;
const controlErrorLogIntervalMs = 2_000;
