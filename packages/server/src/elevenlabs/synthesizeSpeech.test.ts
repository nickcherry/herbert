import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fileExtensionForElevenLabsOutputFormat,
  resolveElevenLabsOutputFormat,
  synthesizeSpeech,
} from "@herbert/server/elevenlabs/synthesizeSpeech";
import { describe, expect, test } from "bun:test";

describe("resolveElevenLabsOutputFormat", () => {
  test("maps local aliases to ElevenLabs output formats", () => {
    expect(resolveElevenLabsOutputFormat({ format: "mp3" })).toBe(
      "mp3_44100_128",
    );
    expect(resolveElevenLabsOutputFormat({ format: "wav" })).toBe("wav_44100");
    expect(resolveElevenLabsOutputFormat({ format: "opus" })).toBe(
      "opus_48000_96",
    );
    expect(resolveElevenLabsOutputFormat({ format: "mp3_44100_64" })).toBe(
      "mp3_44100_64",
    );
  });
});

describe("fileExtensionForElevenLabsOutputFormat", () => {
  test("uses the codec prefix as the generated file extension", () => {
    expect(
      fileExtensionForElevenLabsOutputFormat({
        outputFormat: "mp3_44100_128",
      }),
    ).toBe("mp3");
    expect(
      fileExtensionForElevenLabsOutputFormat({
        outputFormat: "opus_48000_96",
      }),
    ).toBe("opus");
  });
});

describe("synthesizeSpeech", () => {
  test("posts text and voice settings to ElevenLabs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herbert-elevenlabs-"));
    const path = join(directory, "speech.mp3");
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;
    let capturedHeaders: RequestInit["headers"] | undefined;
    const fetcher = (input: string, init: RequestInit): Promise<Response> => {
      capturedUrl = String(input);
      capturedHeaders = init.headers;
      if (typeof init.body === "string") {
        capturedBody = init.body;
      }
      return Promise.resolve(
        new Response(Buffer.from([1, 2, 3]), { status: 200 }),
      );
    };

    try {
      const result = await synthesizeSpeech({
        text: "  Mind the jam.  ",
        apiKey: "test-key",
        voiceId: "voice_123",
        model: "eleven_multilingual_v2",
        outputFormat: "mp3",
        stability: 0.4,
        similarityBoost: 0.8,
        style: 0.1,
        useSpeakerBoost: false,
        speed: 1.1,
        requestTimeoutMs: 5_000,
        outputPath: path,
        fetcher,
      });

      expect(result).toEqual({
        path,
        outputFormat: "mp3_44100_128",
        fileExtension: "mp3",
      });
      expect(new URL(capturedUrl ?? "").pathname).toBe(
        "/v1/text-to-speech/voice_123",
      );
      expect(new URL(capturedUrl ?? "").searchParams.get("output_format")).toBe(
        "mp3_44100_128",
      );
      expect(new Headers(capturedHeaders).get("xi-api-key")).toBe("test-key");
      expect(capturedBody).not.toBeUndefined();
      expect(JSON.parse(capturedBody ?? "")).toEqual({
        text: "Mind the jam.",
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.1,
          use_speaker_boost: false,
          speed: 1.1,
        },
      });
      expect(await readFile(path)).toEqual(Buffer.from([1, 2, 3]));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("surfaces ElevenLabs response errors", async () => {
    const fetcher = (): Promise<Response> =>
      Promise.resolve(
        new Response("invalid voice", {
          status: 422,
          statusText: "Unprocessable Entity",
        }),
      );

    try {
      await synthesizeSpeech({
        text: "hello",
        apiKey: "test-key",
        voiceId: "voice_123",
        outputPath: join(tmpdir(), "unused.mp3"),
        fetcher,
      });
      throw new Error("expected synthesizeSpeech to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw error;
      }
      expect(error.message).toContain(
        "ElevenLabs speech request failed with 422 Unprocessable Entity",
      );
      expect(error.message).toContain("invalid voice");
    }
  });
});
