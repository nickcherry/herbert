import { playAudioFile } from "@herbert/server/audio/playAudioFile";
import { elevenLabsConfig } from "@herbert/server/constants/elevenlabs";
import { synthesizeSpeech } from "@herbert/server/elevenlabs/synthesizeSpeech";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { appendHerbertResponseHistory } from "@herbert/server/persistence/operations/herbertResponseHistory";
import { recordRobotTaskResponse } from "@herbert/server/persistence/operations/robotTaskQueue";
import {
  sendTelegramMessage,
  type SendTelegramMessageParams,
  type SendTelegramMessageResult,
} from "@herbert/server/telegram/sendTelegramMessage";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import pc from "picocolors";

export interface HandleRobotTaskResponseOptions {
  readonly botToken: string;
  readonly chatId: string;
  readonly response: TelegramOpenAIResponse;
  readonly store?: DocumentStore;
  readonly sendMessage?: SendTelegramMessage;
  readonly speakCommentary?: SpeakCommentary;
}

export type SendTelegramMessage = (
  options: SendTelegramMessageParams,
) => Promise<SendTelegramMessageResult>;

export type SpeakCommentary = (
  options: SpeakCommentaryOptions,
) => Promise<void>;

export interface SpeakCommentaryOptions {
  readonly text: string;
}

export async function handleRobotTaskResponse({
  botToken,
  chatId,
  response,
  store,
  sendMessage = sendTelegramMessage,
  speakCommentary = defaultSpeakCommentary,
}: HandleRobotTaskResponseOptions): Promise<void> {
  if (response.telegramMessage !== null) {
    await sendMessage({
      botToken,
      chatId,
      text: response.telegramMessage,
    });
  }

  if (response.spokenMessage !== null) {
    const text = response.spokenMessage;
    process.stdout.write(
      `${pc.bold("spoken")} ${formatKeyValue({
        key: "text",
        value: JSON.stringify(text),
      })}${elevenLabsConfig.spokenMessagePlaybackEnabled ? "" : pc.dim(" (playback disabled)")}\n`,
    );
    if (elevenLabsConfig.spokenMessagePlaybackEnabled) {
      void speakCommentary({ text }).catch((error: unknown) => {
        process.stderr.write(
          `${pc.red(pc.bold("spoken"))} playback failed: ${formatError(error)}\n`,
        );
      });
    }
  }

  await recordRobotTaskResponse({
    chatId,
    response,
    store,
  });
  await appendHerbertResponseHistory({
    chatId,
    response,
    store,
  });
}

async function defaultSpeakCommentary({
  text,
}: SpeakCommentaryOptions): Promise<void> {
  const { path } = await synthesizeSpeech({ text });
  await playAudioFile({ path });
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

export type RobotTaskSendTelegramMessageParams = SendTelegramMessageParams;
