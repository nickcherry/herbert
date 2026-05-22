import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { elevenLabsConfig } from "@herbert/server/constants/elevenlabs";
import { env } from "@herbert/server/constants/env";

export interface SynthesizeSpeechOptions {
  readonly text: string;
  readonly apiKey?: string;
  readonly voiceId?: string;
  readonly model?: string;
  readonly outputFormat?: string;
  readonly stability?: number;
  readonly similarityBoost?: number;
  readonly style?: number;
  readonly useSpeakerBoost?: boolean;
  readonly speed?: number;
  readonly requestTimeoutMs?: number;
  readonly outputPath?: string;
  readonly fetcher?: SpeechFetch;
}

export interface SynthesizeSpeechResult {
  readonly path: string;
  readonly outputFormat: string;
  readonly fileExtension: string;
}

type SpeechFetch = (input: string, init: RequestInit) => Promise<Response>;

export async function synthesizeSpeech({
  text,
  apiKey = requireElevenLabsApiKey(),
  voiceId = defaultElevenLabsVoiceId(),
  model = elevenLabsConfig.defaultSpeechModel,
  outputFormat = elevenLabsConfig.defaultSpeechOutputFormat,
  stability = elevenLabsConfig.defaultSpeechStability,
  similarityBoost = elevenLabsConfig.defaultSpeechSimilarityBoost,
  style = elevenLabsConfig.defaultSpeechStyle,
  useSpeakerBoost = elevenLabsConfig.defaultSpeechUseSpeakerBoost,
  speed = elevenLabsConfig.defaultSpeechSpeed,
  requestTimeoutMs = elevenLabsConfig.defaultSpeechRequestTimeoutMs,
  outputPath,
  fetcher = fetch,
}: SynthesizeSpeechOptions): Promise<SynthesizeSpeechResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("Cannot synthesize speech from empty text.");
  }

  const resolvedOutputFormat = resolveElevenLabsOutputFormat({
    format: outputFormat,
  });
  const fileExtension = fileExtensionForElevenLabsOutputFormat({
    outputFormat: resolvedOutputFormat,
  });
  const path =
    outputPath ?? (await defaultSpeechOutputPath({ extension: fileExtension }));
  const response = await postElevenLabsSpeech({
    apiKey,
    voiceId,
    model,
    outputFormat: resolvedOutputFormat,
    stability,
    similarityBoost,
    style,
    useSpeakerBoost,
    speed,
    text: trimmed,
    requestTimeoutMs,
    fetcher,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  await Bun.write(path, bytes);

  return { path, outputFormat: resolvedOutputFormat, fileExtension };
}

export function defaultElevenLabsVoiceId(): string {
  return env.elevenLabsVoiceId ?? elevenLabsConfig.defaultSpeechVoiceId;
}

export function resolveElevenLabsOutputFormat({
  format,
}: {
  readonly format: string;
}): string {
  if (format === "mp3") {
    return "mp3_44100_128";
  }
  if (format === "wav") {
    return "wav_44100";
  }
  if (format === "opus") {
    return "opus_48000_96";
  }
  return format;
}

export function fileExtensionForElevenLabsOutputFormat({
  outputFormat,
}: {
  readonly outputFormat: string;
}): string {
  const [codec] = outputFormat.split("_");

  if (codec === undefined || codec.length === 0) {
    return "audio";
  }

  return codec;
}

function requireElevenLabsApiKey(): string {
  const apiKey = env.elevenLabsApiKey;

  if (apiKey === undefined) {
    throw new Error("ELEVENLABS_API_KEY is not set in the environment.");
  }

  return apiKey;
}

async function postElevenLabsSpeech({
  apiKey,
  voiceId,
  model,
  outputFormat,
  stability,
  similarityBoost,
  style,
  useSpeakerBoost,
  speed,
  text,
  requestTimeoutMs,
  fetcher,
}: {
  readonly apiKey: string;
  readonly voiceId: string;
  readonly model: string;
  readonly outputFormat: string;
  readonly stability: number;
  readonly similarityBoost: number;
  readonly style: number;
  readonly useSpeakerBoost: boolean;
  readonly speed: number;
  readonly text: string;
  readonly requestTimeoutMs: number;
  readonly fetcher: SpeechFetch;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetcher(
      elevenLabsSpeechUrl({ voiceId, outputFormat }),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
            speed,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await formatElevenLabsError({ response }));
    }

    return response;
  } catch (error) {
    if (isAbortError({ error })) {
      throw new Error(
        `ElevenLabs speech request did not finish within ${requestTimeoutMs}ms.`,
        { cause: error },
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function elevenLabsSpeechUrl({
  voiceId,
  outputFormat,
}: {
  readonly voiceId: string;
  readonly outputFormat: string;
}): string {
  const url = new URL(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    elevenLabsConfig.apiBaseUrl,
  );
  url.searchParams.set("output_format", outputFormat);
  return url.toString();
}

async function formatElevenLabsError({
  response,
}: {
  readonly response: Response;
}): Promise<string> {
  const body = await response.text();
  const detail = body.trim().slice(0, 500);
  const suffix = detail.length === 0 ? "" : `: ${detail}`;
  return `ElevenLabs speech request failed with ${response.status} ${response.statusText}${suffix}`;
}

function isAbortError({ error }: { readonly error: unknown }): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function defaultSpeechOutputPath({
  extension,
}: {
  readonly extension: string;
}): Promise<string> {
  const directory = join(tmpdir(), "herbert-speech");
  await mkdir(directory, { recursive: true });
  return join(
    directory,
    `herbert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
  );
}
