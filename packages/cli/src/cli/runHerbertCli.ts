import { CliUsageError } from "@herbert/cli/cli/CliUsageError";
import { herbertPythonPath } from "@herbert/robot/constants/env";
import { robotServerConfig } from "@herbert/robot/constants/server";
import { runKeyboardDrive } from "@herbert/robot/keyboard/runKeyboardDrive";
import { HerbertController } from "@herbert/robot/robot/HerbertController";
import { runRobotTaskWorker } from "@herbert/robot/tasks/runRobotTaskWorker";
import { playAudioFile } from "@herbert/server/audio/playAudioFile";
import { env } from "@herbert/server/constants/env";
import { openaiConfig } from "@herbert/server/constants/openai";
import { serverConfig } from "@herbert/server/constants/server";
import { telegramConfig } from "@herbert/server/constants/telegram";
import { synthesizeSpeech } from "@herbert/server/openai/synthesizeSpeech";
import { startHerbertServer } from "@herbert/server/server/startHerbertServer";
import { getTelegramUpdates } from "@herbert/server/telegram/getTelegramUpdates";
import { runTelegramMonitor } from "@herbert/server/telegram/runTelegramMonitor";
import { sendTelegramMessage } from "@herbert/server/telegram/sendTelegramMessage";
import {
  type CameraCheckResult,
  motorSpeedSchema,
  speechLanguageSchema,
  speechTextSchema,
  steeringAngleSchema,
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

interface RobotWorkerFlags extends RobotFlags {
  readonly pollIntervalMs: number;
  readonly once: boolean;
}

interface TelegramFlags {
  readonly text: string;
  readonly timeoutSeconds: number;
  readonly limit: number;
  readonly once: boolean;
}

interface AudioTestFlags {
  readonly text: string;
  readonly model: string;
  readonly voice: string;
  readonly instructions?: string;
  readonly format: SpeechAudioFormat;
  readonly speechSpeed: number;
  readonly outputPath?: string;
  readonly player?: string;
  readonly generationTimeoutMs: number;
  readonly playbackTimeoutMs: number;
  readonly playback: boolean;
}

interface ServerFlags {
  readonly host: string;
  readonly port: number;
  readonly telegramPolling: boolean;
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

  if (command === "robot:worker" || command === "worker") {
    await runRobotTaskWorker(parseRobotWorkerFlags({ argv: rest }));
    return;
  }

  if (command === "server:start") {
    const flags = parseServerFlags({ argv: rest });
    const handle = await startHerbertServer({
      host: flags.host,
      port: flags.port,
      telegramPolling: flags.telegramPolling,
    });

    process.stdout.write(
      `${pc.bold("server")} listening ${pc.cyan(handle.url)} ${formatKeyValue({
        key: "telegram",
        value: handle.telegramPolling ? "on" : "off",
      })}\n`,
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

  if (command === "telegram:monitor") {
    const flags = parseTelegramFlags({ argv: rest });
    requireOpenAIApiKey();
    await runTelegramMonitor({
      botToken: requireTelegramBotToken(),
      adminChatIds: requireTelegramAdminChatIds(),
      timeoutSeconds: flags.timeoutSeconds,
      limit: flags.limit,
      coldPollIntervalMs: telegramConfig.coldPollIntervalMs,
      activePollIntervalMs: telegramConfig.activePollIntervalMs,
      activePollWindowMs: telegramConfig.activePollWindowMs,
      once: flags.once,
    });
    return;
  }

  if (command === "audio:test" || command === "speech:test") {
    const flags = parseAudioTestFlags({ argv: rest });
    requireOpenAIApiKey();

    process.stdout.write(
      `${pc.bold("generating")} ${formatKeyValue({
        key: "model",
        value: flags.model,
      })} ${formatKeyValue({
        key: "voice",
        value: flags.voice,
      })} ${formatKeyValue({
        key: "instructions",
        value: flags.instructions === undefined ? "off" : "on",
      })} ${formatKeyValue({
        key: "speed",
        value: String(flags.speechSpeed),
      })} ${formatKeyValue({
        key: "timeoutMs",
        value: String(flags.generationTimeoutMs),
      })}\n`,
    );

    const speech = await synthesizeSpeech({
      text: flags.text,
      model: flags.model,
      voice: flags.voice,
      ...(flags.instructions === undefined
        ? {}
        : { instructions: flags.instructions }),
      format: flags.format,
      speed: flags.speechSpeed,
      requestTimeoutMs: flags.generationTimeoutMs,
      ...(flags.outputPath === undefined
        ? {}
        : { outputPath: flags.outputPath }),
    });

    process.stdout.write(
      `${pc.green(pc.bold("generated"))} ${formatKeyValue({
        key: "path",
        value: speech.path,
      })} ${formatKeyValue({
        key: "model",
        value: flags.model,
      })} ${formatKeyValue({
        key: "voice",
        value: flags.voice,
      })} ${formatKeyValue({
        key: "instructions",
        value: flags.instructions === undefined ? "off" : "on",
      })} ${formatKeyValue({
        key: "speed",
        value: String(flags.speechSpeed),
      })} ${formatKeyValue({
        key: "format",
        value: speech.format,
      })}\n`,
    );

    if (!flags.playback) {
      return;
    }

    process.stdout.write(
      `${pc.bold("playing")} ${formatKeyValue({
        key: "path",
        value: speech.path,
      })} ${formatKeyValue({
        key: "player",
        value: flags.player ?? "default",
      })} ${formatKeyValue({
        key: "timeoutMs",
        value: String(flags.playbackTimeoutMs),
      })}\n`,
    );

    if (flags.player === undefined) {
      await playAudioFile({
        path: speech.path,
        timeoutMs: flags.playbackTimeoutMs,
      });
    } else {
      await playAudioFile({
        path: speech.path,
        player: flags.player,
        timeoutMs: flags.playbackTimeoutMs,
      });
    }

    process.stdout.write(`${pc.green(pc.bold("played"))} ${speech.path}\n`);
    return;
  }

  throw new CliUsageError(`Unknown command: ${command}`);
}

export function renderUsage(): string {
  return [
    pc.bold("Usage"),
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:keyboard")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:bridge-check")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:camera-check")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:say")} <text> [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("robot:worker")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("server:start")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("telegram:test")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("telegram:updates")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("telegram:monitor")} [options]`,
    `  ${pc.cyan("bun herbert")} ${pc.bold("audio:test")} <text> [options]`,
    "",
    pc.bold("Robot options"),
    `  ${pc.cyan("--mock")}                  use the mock Python bridge`,
    `  ${pc.cyan("--python <path>")}         Python executable (default: HERBERT_PYTHON or python3)`,
    `  ${pc.cyan("--speed <1-100>")}         drive motor speed (default: 35)`,
    `  ${pc.cyan("--turn-angle <0-35>")}     steering step for left/right arrows (default: 5)`,
    `  ${pc.cyan("--camera-step <1-20>")}    camera pan/tilt step per keypress (default: 5)`,
    `  ${pc.cyan("--pulse-ms <ms>")}         drive pulse duration after keypress (default: 250)`,
    `  ${pc.cyan("--safety-ms <ms>")}        Python motor watchdog timeout (default: 750)`,
    `  ${pc.cyan("--server-url <url>")}      Herbert server URL for photo upload (default: ${robotServerConfig.baseUrl})`,
    `  ${pc.cyan("--no-photo-upload")}       save photos locally without sending them to the server`,
    `  ${pc.cyan("--poll-ms <ms>")}          robot worker poll interval (default: 2000)`,
    `  ${pc.cyan("--once")}                  robot worker polls or Telegram monitor runs one cycle`,
    "",
    pc.bold("Speech options"),
    `  ${pc.cyan("--text <text>")}           text for robot:say`,
    `  ${pc.cyan("--lang <lang>")}           TTS language (default: en-US)`,
    "",
    pc.bold("Server options"),
    `  ${pc.cyan("--host <host>")}           listen host (default: serverConfig)`,
    `  ${pc.cyan("--port <port>")}           listen port (default: serverConfig)`,
    `  ${pc.cyan("--no-telegram")}           start HTTP server without Telegram polling`,
    "",
    pc.bold("Telegram options"),
    `  ${pc.cyan("--text <text>")}           message for telegram:test`,
    `  ${pc.cyan("--timeout-seconds <n>")}   Telegram getUpdates timeout (default: telegramConfig)`,
    `  ${pc.cyan("--limit <n>")}             update batch limit (default: telegramConfig)`,
    `  ${pc.cyan("--once")}                  poll one batch and exit`,
    "",
    pc.bold("OpenAI audio options"),
    `  ${pc.cyan("--text <text>")}           text for audio:test`,
    `  ${pc.cyan("--voice <voice>")}         OpenAI voice selector (default: ${openaiConfig.defaultSpeechVoice})`,
    `  ${pc.cyan("--model <model>")}         OpenAI speech model (default: ${openaiConfig.defaultSpeechModel})`,
    `  ${pc.cyan("--instructions <text>")}   TTS voice direction (default: Herbert personality)`,
    `  ${pc.cyan("--no-instructions")}       omit TTS voice direction`,
    `  ${pc.cyan("--speech-speed <n>")}      speech speed from 0.25 to 4.0 (default: ${openaiConfig.defaultSpeechSpeed})`,
    `  ${pc.cyan("--format <format>")}       audio format: mp3, wav, opus, aac, flac (default: ${openaiConfig.defaultSpeechFormat})`,
    `  ${pc.cyan("--output <path>")}         write the generated audio to a specific file`,
    `  ${pc.cyan("--player <cmd>")}          playback command (default: afplay on macOS, aplay on Linux)`,
    `  ${pc.cyan("--generate-timeout-ms <ms>")} fail if OpenAI generation does not finish (default: ${openaiConfig.defaultSpeechRequestTimeoutMs})`,
    `  ${pc.cyan("--play-timeout-ms <ms>")}  fail if playback does not finish (default: 30000)`,
    `  ${pc.cyan("--no-play")}               generate the file without playing it`,
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

function parseRobotWorkerFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): RobotWorkerFlags {
  const raw: Record<string, string | boolean | number | undefined> = {
    ...defaultRobotFlags(),
    pollIntervalMs: 2_000,
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

    if (token === "--poll-ms") {
      raw.pollIntervalMs = parseNumberFlag({
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

    throw new CliUsageError(`Unknown robot:worker option: ${token}`);
  }

  return robotWorkerFlagsSchema.parse(raw);
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
  const raw: Record<string, string | boolean | number> = {
    host: serverConfig.host,
    port: serverConfig.port,
    telegramPolling: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--no-telegram") {
      raw.telegramPolling = false;
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
  const raw: Record<string, string | number | boolean> = {
    text: telegramConfig.testMessageText,
    timeoutSeconds: telegramConfig.longPollTimeoutSeconds,
    limit: telegramConfig.pollLimit,
    once: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--once") {
      raw.once = true;
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

function parseAudioTestFlags({
  argv,
}: {
  readonly argv: readonly string[];
}): AudioTestFlags {
  const raw: Record<string, string | number | boolean | undefined> = {
    model: openaiConfig.defaultSpeechModel,
    voice: openaiConfig.defaultSpeechVoice,
    instructions: openaiConfig.defaultSpeechInstructions,
    format: openaiConfig.defaultSpeechFormat,
    speechSpeed: openaiConfig.defaultSpeechSpeed,
    generationTimeoutMs: openaiConfig.defaultSpeechRequestTimeoutMs,
    playbackTimeoutMs: 30_000,
    playback: true,
  };
  const textParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    const option = parseLongOption({ token });
    const flag = option.flag;

    if (flag === "--text") {
      raw.text = readOptionValue({ argv, index, flag, value: option.value });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--voice") {
      raw.voice = readOptionValue({ argv, index, flag, value: option.value });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--model") {
      raw.model = readOptionValue({ argv, index, flag, value: option.value });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--instructions") {
      raw.instructions = readOptionValue({
        argv,
        index,
        flag,
        value: option.value,
      });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--no-instructions") {
      rejectUnexpectedOptionValue({ flag, value: option.value });
      raw.instructions = undefined;
      continue;
    }

    if (flag === "--format") {
      raw.format = readOptionValue({ argv, index, flag, value: option.value });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--speech-speed") {
      raw.speechSpeed = parseNumberFlag({
        value: readOptionValue({ argv, index, flag, value: option.value }),
        flag,
      });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--output") {
      raw.outputPath = readOptionValue({
        argv,
        index,
        flag,
        value: option.value,
      });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--player") {
      raw.player = readOptionValue({ argv, index, flag, value: option.value });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--generate-timeout-ms") {
      raw.generationTimeoutMs = parseNumberFlag({
        value: readOptionValue({ argv, index, flag, value: option.value }),
        flag,
      });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--play-timeout-ms") {
      raw.playbackTimeoutMs = parseNumberFlag({
        value: readOptionValue({ argv, index, flag, value: option.value }),
        flag,
      });
      if (option.value === undefined) {
        index += 1;
      }
      continue;
    }

    if (flag === "--no-play") {
      rejectUnexpectedOptionValue({ flag, value: option.value });
      raw.playback = false;
      continue;
    }

    if (token.startsWith("--")) {
      throw new CliUsageError(`Unknown audio:test option: ${token}`);
    }

    textParts.push(token);
  }

  if (raw.text === undefined && textParts.length > 0) {
    raw.text = textParts.join(" ");
  }

  return audioTestFlagsSchema.parse(raw);
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

function requireOpenAIApiKey(): string {
  const apiKey = env.openaiApiKey;

  if (apiKey === undefined) {
    throw new Error("OPENAI_API_KEY is not set in the environment.");
  }

  return apiKey;
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

function readOptionValue({
  argv,
  index,
  flag,
  value,
}: {
  readonly argv: readonly string[];
  readonly index: number;
  readonly flag: string;
  readonly value?: string;
}): string {
  return value ?? readFlagValue({ argv, index, flag });
}

function parseLongOption({ token }: { readonly token: string }): {
  readonly flag: string;
  readonly value?: string;
} {
  const separatorIndex = token.indexOf("=");

  if (!token.startsWith("--") || separatorIndex === -1) {
    return { flag: token };
  }

  const flag = token.slice(0, separatorIndex);
  const value = token.slice(separatorIndex + 1);

  if (value.length === 0) {
    throw new CliUsageError(`Missing value for ${flag}`);
  }

  return { flag, value };
}

function rejectUnexpectedOptionValue({
  flag,
  value,
}: {
  readonly flag: string;
  readonly value?: string;
}): void {
  if (value !== undefined) {
    throw new CliUsageError(`Unexpected value for ${flag}`);
  }
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

const robotWorkerFlagsSchema = robotFlagsSchema.extend({
  pollIntervalMs: z.number().int().min(250).max(60_000),
  once: z.boolean(),
});

const serverFlagsSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0).max(65_535),
  telegramPolling: z.boolean(),
});

const telegramFlagsSchema = z.object({
  text: z.string().min(1),
  timeoutSeconds: z.number().int().min(1).max(50),
  limit: z.number().int().min(1).max(100),
  once: z.boolean(),
});

const speechAudioFormats = ["mp3", "wav", "opus", "aac", "flac"] as const;

type SpeechAudioFormat = (typeof speechAudioFormats)[number];

const audioTestFlagsSchema = z.object({
  text: z.string().trim().min(1).max(4096),
  model: z.string().trim().min(1),
  voice: z.string().trim().min(1),
  instructions: z.string().trim().min(1).max(1_000).optional(),
  format: z.enum(speechAudioFormats),
  speechSpeed: z.number().min(0.25).max(4.0),
  outputPath: z.string().trim().min(1).optional(),
  player: z.string().trim().min(1).optional(),
  generationTimeoutMs: z.number().int().min(1_000).max(300_000),
  playbackTimeoutMs: z.number().int().min(1_000).max(300_000),
  playback: z.boolean(),
});
