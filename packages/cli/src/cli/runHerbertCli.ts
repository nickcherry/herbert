import { CliUsageError } from "@herbert/cli/cli/CliUsageError";
import { herbertPythonPath } from "@herbert/robot/constants/env";
import { robotServerConfig } from "@herbert/robot/constants/server";
import { runKeyboardDrive } from "@herbert/robot/keyboard/runKeyboardDrive";
import { HerbertController } from "@herbert/robot/robot/HerbertController";
import { runVideoStream } from "@herbert/robot/video/runVideoStream";
import { env } from "@herbert/server/constants/env";
import { serverConfig } from "@herbert/server/constants/server";
import { telegramConfig } from "@herbert/server/constants/telegram";
import { startHerbertServer } from "@herbert/server/server/startHerbertServer";
import { getTelegramUpdates } from "@herbert/server/telegram/getTelegramUpdates";
import { sendTelegramMessage } from "@herbert/server/telegram/sendTelegramMessage";
import {
  type CameraCheckResult,
  motorSpeedSchema,
  speechLanguageSchema,
  speechTextSchema,
  steeringAngleSchema,
  videoFrameHeightSchema,
  videoFrameWidthSchema,
} from "@herbert/shared";
import pc from "picocolors";
import { z } from "zod";

export interface RunHerbertCliOptions {
  readonly argv: readonly string[];
}

interface RobotFlags {
  readonly mock: boolean;
  readonly pythonPath: string;
  readonly speed: number;
  readonly turnAngle: number;
  readonly cameraStep: number;
  readonly pulseMs: number;
  readonly safetyTimeoutMs: number;
  readonly serverUrl: string;
  readonly photoUpload: boolean;
}

interface RobotSayFlags extends RobotFlags {
  readonly text: string;
  readonly lang: string;
}

interface RobotVideoFlags extends RobotFlags {
  readonly fps: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly once: boolean;
}

interface TelegramFlags {
  readonly text: string;
  readonly timeoutSeconds: number;
  readonly limit: number;
}

interface ServerFlags {
  readonly host: string;
  readonly port: number;
}

export async function runHerbertCli({
  argv,
}: RunHerbertCliOptions): Promise<void> {
  const command = argv[0] ?? "help";
  const rest = argv.slice(1);

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(renderUsage());
    return;
  }

  if (command === "robot:keyboard" || command === "keyboard") {
    await runKeyboardDrive(parseRobotFlags({ argv: rest }));
    return;
  }

  if (command === "robot:video-stream" || command === "video:stream") {
    await runVideoStream(parseRobotVideoFlags({ argv: rest }));
    return;
  }

  if (command === "robot:bridge-check" || command === "bridge:check") {
    const flags = parseRobotFlags({ argv: rest });
    const robot = await HerbertController.create({
      mock: flags.mock,
      pythonPath: flags.pythonPath,
      safetyTimeoutMs: flags.safetyTimeoutMs,
    });

    try {
      await robot.ping();
      process.stdout.write(`${pc.bold("bridge")} ${pc.green("ok")}\n`);
    } finally {
      await robot.close();
    }

    return;
  }

  if (command === "robot:camera-check" || command === "camera:check") {
    const flags = parseRobotFlags({ argv: rest });
    const robot = await HerbertController.create({
      mock: flags.mock,
      pythonPath: flags.pythonPath,
      safetyTimeoutMs: flags.safetyTimeoutMs,
    });

    try {
      const result = await robot.cameraCheck();
      process.stdout.write(renderCameraCheckResult({ result }));
    } finally {
      await robot.close();
    }

    return;
  }

  if (command === "robot:photo-check" || command === "photo:check") {
    const flags = parseRobotFlags({ argv: rest });
    const robot = await HerbertController.create({
      mock: flags.mock,
      pythonPath: flags.pythonPath,
      safetyTimeoutMs: flags.safetyTimeoutMs,
    });

    try {
      const result = await robot.takePhoto();
      process.stdout.write(
        `${pc.bold("photo")} captured ${formatKeyValue({
          key: "path",
          value: result.path,
        })}\n`,
      );
    } finally {
      await robot.close();
    }

    return;
  }

  if (command === "robot:say" || command === "say") {
    const flags = parseRobotSayFlags({ argv: rest });
    const robot = await HerbertController.create({
      mock: flags.mock,
      pythonPath: flags.pythonPath,
      safetyTimeoutMs: flags.safetyTimeoutMs,
    });

    try {
      await robot.say({ text: flags.text, lang: flags.lang });
      process.stdout.write(
        `${pc.bold("voice")} said ${JSON.stringify(flags.text)}\n`,
      );
    } finally {
      await robot.close();
    }

    return;
  }

  if (command === "server:start") {
    const flags = parseServerFlags({ argv: rest });
    const handle = await startHerbertServer({
      host: flags.host,
      port: flags.port,
    });

    process.stdout.write(
      `${pc.bold("server")} listening ${pc.cyan(handle.url)}\n`,
    );

    await waitForShutdown(async () => {
      await handle.stop();
    });
    return;
  }

  if (command === "telegram:test") {
    const flags = parseTelegramFlags({ argv: rest });
    const result = await sendTelegramMessage({
      botToken: requireTelegramBotToken(),
      chatId: requirePrimaryTelegramAdminChatId(),
      text: flags.text,
    });

    process.stdout.write(
      `${pc.green(pc.bold("sent"))} ${formatKeyValue({
        key: "message_id",
        value: String(result.messageId),
      })}\n`,
    );
    return;
  }

  if (command === "telegram:updates") {
    const flags = parseTelegramFlags({ argv: rest });
    const result = await getTelegramUpdates({
      botToken: requireTelegramBotToken(),
      timeoutSeconds: flags.timeoutSeconds,
      limit: flags.limit,
    });

    for (const update of result.updates) {
      const message = update.message ?? update.edited_message;
      const chatId = message === undefined ? "none" : String(message.chat.id);
      const text = message?.text ?? "";
      process.stdout.write(
        `${pc.bold("update")} ${formatKeyValue({
          key: "id",
          value: String(update.update_id),
        })} ${formatKeyValue({
          key: "chat",
          value: chatId,
        })} ${formatKeyValue({
          key: "text",
          value: JSON.stringify(text),
        })}\n`,
      );
    }

    if (result.updates.length === 0) {
      process.stdout.write(`${pc.dim("no updates")}\n`);
    }

    return;
  }

  throw new CliUsageError(`Unknown command: ${command}`);
}

export function renderUsage(): string {
  return [
    pc.bold("Usage"),
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:keyboard")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:video-stream")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:bridge-check")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:camera-check")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:photo-check")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:say")} <text> [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("server:start")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("telegram:test")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("telegram:updates")} [options]`,
    "",
    pc.bold("Robot options"),
    `  ${pc.cyan("--mock")}                  use the mock Python bridge`,
    `  ${pc.cyan("--python <path>")}         Python executable (default: HERBERT_PYTHON or python3)`,
    `  ${pc.cyan("--speed <1-100>")}         drive motor speed (default: 35)`,
    `  ${pc.cyan("--turn-angle <0-35>")}     steering step for left/right arrows (default: 5)`,
    `  ${pc.cyan("--camera-step <1-20>")}    camera pan/tilt step per keypress (default: 5)`,
    `  ${pc.cyan("--pulse-ms <ms>")}         drive pulse duration after keypress (default: 250)`,
    `  ${pc.cyan("--safety-ms <ms>")}        Python motor watchdog timeout (default: 750)`,
    `  ${pc.cyan("--server-url <url>")}      Herbert server URL for photo/video upload (default: ${robotServerConfig.baseUrl})`,
    `  ${pc.cyan("--no-photo-upload")}       save photos locally without sending them to the server`,
    `  ${pc.cyan("--fps <n>")}               video stream frames per second (default: 2)`,
    `  ${pc.cyan("--frame-width <px>")}      video stream frame width (default: 640)`,
    `  ${pc.cyan("--frame-height <px>")}     video stream frame height (default: 480)`,
    `  ${pc.cyan("--once")}                  send one video frame and exit`,
    "",
    pc.bold("Speech options"),
    `  ${pc.cyan("--text <text>")}           text for robot:say`,
    `  ${pc.cyan("--lang <lang>")}           TTS language (default: en-US)`,
    "",
    pc.bold("Server options"),
    `  ${pc.cyan("--host <host>")}           listen host (default: serverConfig)`,
    `  ${pc.cyan("--port <port>")}           listen port (default: serverConfig)`,
    `  ${pc.cyan("env HERBERT_BASIC_AUTH_*")} required Basic Auth username/password`,
    `  ${pc.cyan("env HERBERT_TLS_*")}        optional cert/key paths for direct HTTPS`,
    "",
    pc.bold("Telegram options"),
    `  ${pc.cyan("--text <text>")}           message for telegram:test`,
    `  ${pc.cyan("--timeout-seconds <n>")}   Telegram getUpdates timeout (default: telegramConfig)`,
    `  ${pc.cyan("--limit <n>")}             update batch limit (default: telegramConfig)`,
    "",
  ].join("\n");
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

function renderCameraCheckResult({
  result,
}: {
  readonly result: CameraCheckResult;
}): string {
  const lines = [
    `${pc.bold("camera")} ${formatCheckStatus({
      ok:
        result.picamera2.available &&
        result.picamera2.cameraCount !== undefined &&
        result.picamera2.cameraCount > 0,
    })}`,
    `${pc.bold("picamera2")} ${formatKeyValue({
      key: "available",
      value: String(result.picamera2.available),
    })} ${formatKeyValue({
      key: "count",
      value: String(result.picamera2.cameraCount ?? "unknown"),
    })} ${formatKeyValue({
      key: "version",
      value: result.picamera2.version ?? "unknown",
    })}`,
  ];

  if (result.picamera2.error !== undefined) {
    lines.push(`${pc.red("picamera2 error")} ${result.picamera2.error}`);
  }

  if (
    result.picamera2.cameras !== undefined &&
    result.picamera2.cameras.length > 0
  ) {
    lines.push(
      `${pc.bold("picamera2 cameras")} ${JSON.stringify(result.picamera2.cameras)}`,
    );
  }

  lines.push(
    `${pc.bold("rpicam-hello")} ${formatKeyValue({
      key: "available",
      value: String(result.rpicamHello.available),
    })} ${formatKeyValue({
      key: "exit",
      value: String(result.rpicamHello.exitCode ?? "unknown"),
    })}`,
  );

  if (result.rpicamHello.error !== undefined) {
    lines.push(`${pc.red("rpicam-hello error")} ${result.rpicamHello.error}`);
  }

  if (hasText(result.rpicamHello.stdout)) {
    lines.push(`${pc.bold("stdout")}\n${result.rpicamHello.stdout.trim()}`);
  }

  if (hasText(result.rpicamHello.stderr)) {
    lines.push(`${pc.bold("stderr")}\n${result.rpicamHello.stderr.trim()}`);
  }

  return lines.join("\n") + "\n";
}

function formatCheckStatus({ ok }: { readonly ok: boolean }): string {
  return ok ? pc.green("detected") : pc.red("not detected");
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function parseRobotFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): RobotFlags {
  const raw = defaultRobotFlags();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    const nextIndex = readRobotOption({ argv, index, raw });
    if (nextIndex !== undefined) {
      index = nextIndex;
      continue;
    }

    throw new CliUsageError(`Unknown robot option: ${token}`);
  }

  return robotFlagsSchema.parse(raw);
}

function parseRobotSayFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): RobotSayFlags {
  const raw: Record<string, string | boolean | number | undefined> = {
    ...defaultRobotFlags(),
    lang: "en-US",
  };
  const textParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    const nextIndex = readRobotOption({ argv, index, raw });
    if (nextIndex !== undefined) {
      index = nextIndex;
      continue;
    }

    if (token === "--text") {
      raw.text = readFlagValue({ argv, index, flag: token });
      index += 1;
      continue;
    }

    if (token === "--lang") {
      raw.lang = readFlagValue({ argv, index, flag: token });
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      throw new CliUsageError(`Unknown robot:say option: ${token}`);
    }

    textParts.push(token);
  }

  if (raw.text === undefined && textParts.length > 0) {
    raw.text = textParts.join(" ");
  }

  return robotSayFlagsSchema.parse(raw);
}

function parseRobotVideoFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): RobotVideoFlags {
  const raw: Record<string, string | boolean | number | undefined> = {
    ...defaultRobotFlags(),
    fps: 2,
    frameWidth: 640,
    frameHeight: 480,
    once: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    const nextIndex = readRobotOption({ argv, index, raw });
    if (nextIndex !== undefined) {
      index = nextIndex;
      continue;
    }

    if (token === "--fps") {
      raw.fps = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    if (token === "--frame-width") {
      raw.frameWidth = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    if (token === "--frame-height") {
      raw.frameHeight = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    if (token === "--once") {
      raw.once = true;
      continue;
    }

    throw new CliUsageError(`Unknown robot:video-stream option: ${token}`);
  }

  return robotVideoFlagsSchema.parse(raw);
}

function defaultRobotFlags(): Record<string, string | boolean | number> {
  return {
    mock: false,
    pythonPath: herbertPythonPath,
    speed: 35,
    turnAngle: 5,
    cameraStep: 5,
    pulseMs: 250,
    safetyTimeoutMs: 750,
    serverUrl: robotServerConfig.baseUrl,
    photoUpload: true,
  };
}

function readRobotOption({
  argv,
  index,
  raw,
}: {
  readonly argv: readonly string[];
  readonly index: number;
  readonly raw: Record<string, string | boolean | number | undefined>;
}): number | undefined {
  const token = argv[index];

  if (token === "--mock") {
    raw.mock = true;
    return index;
  }

  if (token === "--no-photo-upload") {
    raw.photoUpload = false;
    return index;
  }

  if (token === "--python") {
    raw.pythonPath = readFlagValue({ argv, index, flag: token });
    return index + 1;
  }

  if (token === "--speed") {
    raw.speed = parseNumberFlag({
      value: readFlagValue({ argv, index, flag: token }),
      flag: token,
    });
    return index + 1;
  }

  if (token === "--turn-angle") {
    raw.turnAngle = parseNumberFlag({
      value: readFlagValue({ argv, index, flag: token }),
      flag: token,
    });
    return index + 1;
  }

  if (token === "--camera-step") {
    raw.cameraStep = parseNumberFlag({
      value: readFlagValue({ argv, index, flag: token }),
      flag: token,
    });
    return index + 1;
  }

  if (token === "--pulse-ms") {
    raw.pulseMs = parseNumberFlag({
      value: readFlagValue({ argv, index, flag: token }),
      flag: token,
    });
    return index + 1;
  }

  if (token === "--safety-ms") {
    raw.safetyTimeoutMs = parseNumberFlag({
      value: readFlagValue({ argv, index, flag: token }),
      flag: token,
    });
    return index + 1;
  }

  if (token === "--server-url") {
    raw.serverUrl = readFlagValue({ argv, index, flag: token });
    return index + 1;
  }

  return undefined;
}

function parseServerFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): ServerFlags {
  const raw: Record<string, string | number> = {
    host: serverConfig.host,
    port: serverConfig.port,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--host") {
      raw.host = readFlagValue({ argv, index, flag: token });
      index += 1;
      continue;
    }

    if (token === "--port") {
      raw.port = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown server option: ${token}`);
  }

  return serverFlagsSchema.parse(raw);
}

function parseTelegramFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): TelegramFlags {
  const raw: Record<string, string | number> = {
    text: telegramConfig.testMessageText,
    timeoutSeconds: telegramConfig.longPollTimeoutSeconds,
    limit: telegramConfig.pollLimit,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--text") {
      raw.text = readFlagValue({ argv, index, flag: token });
      index += 1;
      continue;
    }

    if (token === "--timeout-seconds") {
      raw.timeoutSeconds = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    if (token === "--limit") {
      raw.limit = parseNumberFlag({
        value: readFlagValue({ argv, index, flag: token }),
        flag: token,
      });
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown telegram option: ${token}`);
  }

  return telegramFlagsSchema.parse(raw);
}

function requireTelegramBotToken(): string {
  const botToken = env.telegramBotToken;

  if (botToken === undefined) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in the environment.");
  }

  return botToken;
}

function requireTelegramAdminChatIds(): readonly string[] {
  const chatIds = env.telegramAdminChatIds;

  if (chatIds.length === 0) {
    throw new Error("TELEGRAM_ADMIN_CHAT_IDS is not set in the environment.");
  }

  return chatIds;
}

function requirePrimaryTelegramAdminChatId(): string {
  const chatId = requireTelegramAdminChatIds()[0];

  if (chatId === undefined) {
    throw new Error("TELEGRAM_ADMIN_CHAT_IDS is not set in the environment.");
  }

  return chatId;
}

async function waitForShutdown(stop: () => Promise<void>): Promise<void> {
  let stopping = false;
  let resolveStopped: (() => void) | undefined;
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  const onSignal = (): void => {
    if (stopping) {
      return;
    }

    stopping = true;
    void stop().finally(() => {
      resolveStopped?.();
    });
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  await stopped;

  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
}

function readFlagValue({
  argv,
  index,
  flag,
}: {
  readonly argv: readonly string[];
  readonly index: number;
  readonly flag: string;
}): string {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new CliUsageError(`Missing value for ${flag}`);
  }

  return value;
}

function parseNumberFlag({
  value,
  flag,
}: {
  readonly value: string;
  readonly flag: string;
}): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new CliUsageError(`Expected a number for ${flag}`);
  }

  return parsed;
}

const robotFlagsSchema = z.object({
  mock: z.boolean(),
  pythonPath: z.string().min(1),
  speed: motorSpeedSchema.refine((speed) => speed > 0),
  turnAngle: steeringAngleSchema.refine((angle) => angle >= 0),
  cameraStep: z.number().int().min(1).max(20),
  pulseMs: z.number().int().min(50).max(5_000),
  safetyTimeoutMs: z.number().int().min(100).max(10_000),
  serverUrl: z.string().url(),
  photoUpload: z.boolean(),
});

const robotSayFlagsSchema = robotFlagsSchema.extend({
  text: speechTextSchema,
  lang: speechLanguageSchema,
});

const robotVideoFlagsSchema = robotFlagsSchema.extend({
  fps: z.number().min(0.2).max(10),
  frameWidth: videoFrameWidthSchema,
  frameHeight: videoFrameHeightSchema,
  once: z.boolean(),
});

const serverFlagsSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0).max(65_535),
});

const telegramFlagsSchema = z.object({
  text: z.string().min(1),
  timeoutSeconds: z.number().int().min(1).max(50),
  limit: z.number().int().min(1).max(100),
});
