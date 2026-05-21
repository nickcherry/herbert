import {
  type KeyboardAction,
  parseKeyboardInput,
} from "@herbert/robot/keyboard/parseKeyboardInput";
import { clamp } from "@herbert/robot/robot/clamp";
import {
  type CameraPosition,
  HerbertController,
} from "@herbert/robot/robot/HerbertController";
import { uploadRobotPhoto } from "@herbert/robot/server/uploadRobotPhoto";
import {
  cameraAngleLimits,
  motorSpeedSchema,
  steeringAngleSchema,
} from "@herbert/shared";
import pc from "picocolors";

export interface KeyboardDriveOptions {
  readonly mock: boolean;
  readonly pythonPath?: string;
  readonly speed: number;
  readonly turnAngle: number;
  readonly cameraStep: number;
  readonly pulseMs: number;
  readonly safetyTimeoutMs: number;
  readonly serverUrl: string;
  readonly photoUpload: boolean;
}

export async function runKeyboardDrive(
  options: KeyboardDriveOptions,
): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error("Keyboard mode requires an interactive terminal.");
  }

  const speed = positiveMotorSpeedSchema.parse(options.speed);
  const turnAngle = nonNegativeSteeringAngleSchema.parse(options.turnAngle);
  const robot = await HerbertController.create({
    mock: options.mock,
    pythonPath: options.pythonPath,
    safetyTimeoutMs: options.safetyTimeoutMs,
  });

  const input = process.stdin;
  const wasRaw = input.isRaw;
  let cameraPosition = robot.getCameraPosition();
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let commandChain = Promise.resolve();
  let shutdownStarted = false;
  let resolveShutdown: (() => void) | undefined;
  const shutdownComplete = new Promise<void>((resolve) => {
    resolveShutdown = resolve;
  });

  const enqueue = (run: () => Promise<void>): void => {
    commandChain = commandChain.then(run).catch((error: unknown) => {
      process.stderr.write(`${formatUnknownError(error)}\n`);
    });
  };

  const clearStopTimer = (): void => {
    if (stopTimer === undefined) {
      return;
    }

    clearTimeout(stopTimer);
    stopTimer = undefined;
  };

  const scheduleStop = (): void => {
    if (shutdownStarted) {
      return;
    }

    clearStopTimer();
    stopTimer = setTimeout(() => {
      stopTimer = undefined;

      if (shutdownStarted) {
        return;
      }

      enqueue(async () => {
        await stopAndCenterSteering();
      });
    }, options.pulseMs);
  };

  const handleAction = (action: KeyboardAction): void => {
    if (action.type === "drive") {
      writeStatus({
        label: "drive",
        detail: formatDriveAction({ action, pulseMs: options.pulseMs }),
      });
      enqueue(async () => {
        await robot.setSteering({ angle: action.steeringAngle });
        await robot.setMotor({ speed: action.motorSpeed });
        scheduleStop();
      });
      return;
    }

    if (action.type === "camera_delta") {
      const targetPosition = nextCameraPosition({
        position: cameraPosition,
        action,
      });
      const direction = formatCameraDirection({ action });
      cameraPosition = targetPosition;
      writeStatus({
        label: "camera",
        detail: `${direction} pan=${targetPosition.pan} tilt=${targetPosition.tilt}`,
      });
      enqueue(async () => {
        if (action.axis === "pan") {
          await robot.setCameraPan({ angle: targetPosition.pan });
          return;
        }

        await robot.setCameraTilt({ angle: targetPosition.tilt });
      });
      return;
    }

    if (action.type === "take_photo") {
      writeStatus({ label: "photo", detail: "capturing..." });
      enqueue(async () => {
        const result = await robot.takePhoto();
        writeStatus({ label: "photo", detail: `saved ${result.path}` });

        if (!options.photoUpload) {
          return;
        }

        if (options.mock) {
          writeStatus({
            label: "photo",
            detail: "upload skipped in mock mode",
          });
          return;
        }

        writeStatus({ label: "photo", detail: "uploading to server..." });
        const upload = await uploadRobotPhoto({
          serverUrl: options.serverUrl,
          path: result.path,
        });
        writeStatus({
          label: "photo",
          detail: `sent to telegram message_ids=${upload.messageIds.join(",")}`,
        });
      });
      return;
    }

    if (action.type === "say") {
      writeStatus({ label: "voice", detail: JSON.stringify(action.text) });
      enqueue(async () => {
        await robot.say({ text: action.text });
      });
      return;
    }

    if (action.type === "stop") {
      clearStopTimer();
      writeStatus({
        label: "stop",
        detail: "motors stopped, steering centered",
      });
      enqueue(async () => {
        await stopAndCenterSteering();
      });
      return;
    }

    writeStatus({ label: "quit", detail: "stopping Herbert" });
    void shutdown();
  };

  const onData = (data: Buffer): void => {
    const actions = parseKeyboardInput({
      input: data.toString("utf8"),
      speed,
      turnAngle,
      cameraStep: options.cameraStep,
    });

    for (const action of actions) {
      handleAction(action);
    }
  };

  const onSignal = (): void => {
    void shutdown();
  };

  const shutdown = async (): Promise<void> => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    clearStopTimer();
    input.off("data", onData);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);

    await commandChain;

    try {
      await stopAndCenterSteering();
    } finally {
      await robot.close();
      input.setRawMode(wasRaw);
      input.pause();
      resolveShutdown?.();
    }
  };

  process.stdout.write(renderKeyboardHelp({ mock: options.mock }));
  input.setRawMode(true);
  input.resume();
  input.on("data", onData);
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  await shutdownComplete;

  async function stopAndCenterSteering(): Promise<void> {
    await robot.stop();
    await robot.setSteering({ angle: 0 });
  }
}

function renderKeyboardHelp({ mock }: { readonly mock: boolean }): string {
  const mode = mock ? "mock" : "hardware";

  return [
    `${pc.bold("Herbert keyboard control")} ${pc.dim(`(${mode})`)}`,
    "",
    `${pc.bold("Drive")}   arrows  forward/reverse/forward-left arc/forward-right arc`,
    `${pc.bold("Camera")}  wasd    pan/tilt`,
    `${pc.bold("Photo")}   p       take photo`,
    `${pc.bold("Voice")}   v       say hello`,
    `${pc.bold("Stop")}    space   stop motors and center steering`,
    `${pc.bold("Quit")}    q       stop and quit`,
    "",
    pc.dim("Raw keyboard mode is active; keypresses print status below."),
    "",
  ].join("\n");
}

function writeStatus({
  label,
  detail,
}: {
  readonly label: string;
  readonly detail: string;
}): void {
  process.stdout.write(`${pc.bold(label.padEnd(7))} ${detail}\n`);
}

function formatDriveAction({
  action,
  pulseMs,
}: {
  readonly action: Extract<KeyboardAction, { readonly type: "drive" }>;
  readonly pulseMs: number;
}): string {
  const direction = driveDirectionForAction({ action });

  return `${direction} speed=${action.motorSpeed} steering=${action.steeringAngle} pulse=${pulseMs}ms`;
}

function driveDirectionForAction({
  action,
}: {
  readonly action: Extract<KeyboardAction, { readonly type: "drive" }>;
}): string {
  if (action.motorSpeed < 0) {
    return "reverse pulse";
  }

  if (action.steeringAngle < 0) {
    return "forward-left arc";
  }

  if (action.steeringAngle > 0) {
    return "forward-right arc";
  }

  return "forward pulse";
}

function formatCameraDirection({
  action,
}: {
  readonly action: Extract<KeyboardAction, { readonly type: "camera_delta" }>;
}): string {
  if (action.axis === "pan") {
    return action.delta < 0 ? "left" : "right";
  }

  return action.delta < 0 ? "down" : "up";
}

function nextCameraPosition({
  position,
  action,
}: {
  readonly position: CameraPosition;
  readonly action: Extract<KeyboardAction, { readonly type: "camera_delta" }>;
}): CameraPosition {
  if (action.axis === "pan") {
    return {
      ...position,
      pan: clamp({
        value: position.pan + action.delta,
        min: cameraAngleLimits.min,
        max: cameraAngleLimits.max,
      }),
    };
  }

  return {
    ...position,
    tilt: clamp({
      value: position.tilt + action.delta,
      min: cameraAngleLimits.min,
      max: cameraAngleLimits.max,
    }),
  };
}

function formatUnknownError(error: unknown): string {
  const label = pc.red(pc.bold("error"));

  if (error instanceof Error) {
    return `${label} ${error.message}`;
  }

  return `${label} ${String(error)}`;
}

const positiveMotorSpeedSchema = motorSpeedSchema.refine((speed) => speed > 0);

const nonNegativeSteeringAngleSchema = steeringAngleSchema.refine(
  (angle) => angle >= 0,
);
