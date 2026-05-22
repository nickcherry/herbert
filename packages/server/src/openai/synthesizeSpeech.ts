import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openaiConfig } from "@herbert/server/constants/openai";
import { createOpenAIClient } from "@herbert/server/openai/createOpenAIClient";
import type OpenAI from "openai";

export interface SynthesizeSpeechOptions {
  readonly text: string;
  readonly model?: string;
  readonly voice?: string;
  readonly format?: "mp3" | "wav" | "opus" | "aac" | "flac";
  readonly outputPath?: string;
  readonly client?: OpenAI;
}

export interface SynthesizeSpeechResult {
  readonly path: string;
  readonly format: "mp3" | "wav" | "opus" | "aac" | "flac";
}

export async function synthesizeSpeech({
  text,
  model = openaiConfig.defaultSpeechModel,
  voice = openaiConfig.defaultSpeechVoice,
  format = openaiConfig.defaultSpeechFormat,
  outputPath,
  client = createOpenAIClient(),
}: SynthesizeSpeechOptions): Promise<SynthesizeSpeechResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("Cannot synthesize speech from empty text.");
  }

  const path = outputPath ?? (await defaultSpeechOutputPath({ format }));
  const response = await client.audio.speech.create({
    model,
    voice,
    input: trimmed,
    response_format: format,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  await Bun.write(path, bytes);

  return { path, format };
}

async function defaultSpeechOutputPath({
  format,
}: {
  readonly format: "mp3" | "wav" | "opus" | "aac" | "flac";
}): Promise<string> {
  const directory = join(tmpdir(), "herbert-speech");
  await mkdir(directory, { recursive: true });
  return join(
    directory,
    `herbert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`,
  );
}
