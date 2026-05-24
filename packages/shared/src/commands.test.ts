import {
  bridgeProtocolVersion,
  bridgeResponseSchema,
  captureFrameResultSchema,
  robotCommandPayloadSchema,
  robotCommandSchema,
} from "@herbert/shared";
import { describe, expect, test } from "bun:test";

describe("robot command schemas", () => {
  test("accept low-level movement commands", () => {
    expect(
      robotCommandPayloadSchema.parse({
        type: "set_motor",
        speed: 35,
      }),
    ).toEqual({
      type: "set_motor",
      speed: 35,
    });

    expect(
      robotCommandSchema.parse({
        id: "cmd-1",
        type: "set_steering",
        angle: -20,
      }),
    ).toEqual({
      id: "cmd-1",
      type: "set_steering",
      angle: -20,
    });
  });

  test("accept speech commands", () => {
    const maxLengthSpeech = "x".repeat(800);

    expect(
      robotCommandPayloadSchema.parse({
        type: "say",
        text: "hello from Herbert",
        lang: "en-US",
      }),
    ).toEqual({
      type: "say",
      text: "hello from Herbert",
      lang: "en-US",
    });

    expect(
      robotCommandPayloadSchema.parse({
        type: "say",
        text: maxLengthSpeech,
      }),
    ).toEqual({
      type: "say",
      text: maxLengthSpeech,
    });
  });

  test("accept camera diagnostics commands", () => {
    expect(
      robotCommandPayloadSchema.parse({
        type: "camera_check",
      }),
    ).toEqual({
      type: "camera_check",
    });
  });

  test("accept video frame capture commands", () => {
    expect(
      robotCommandPayloadSchema.parse({
        type: "capture_frame",
        width: 640,
        height: 480,
      }),
    ).toEqual({
      type: "capture_frame",
      width: 640,
      height: 480,
    });

    expect(
      captureFrameResultSchema.parse({
        imageBase64: "abc123",
        contentType: "image/jpeg",
        width: 640,
        height: 480,
        capturedAtMs: 123,
      }),
    ).toEqual({
      imageBase64: "abc123",
      contentType: "image/jpeg",
      width: 640,
      height: 480,
      capturedAtMs: 123,
    });
  });

  test("reject unsafe out-of-range commands", () => {
    expect(() =>
      robotCommandPayloadSchema.parse({
        type: "set_motor",
        speed: 101,
      }),
    ).toThrow();

    expect(() =>
      robotCommandPayloadSchema.parse({
        type: "set_camera_tilt",
        angle: 90,
      }),
    ).toThrow();

    expect(() =>
      robotCommandPayloadSchema.parse({
        type: "capture_frame",
        width: 80,
        height: 480,
      }),
    ).toThrow();

    expect(() =>
      robotCommandPayloadSchema.parse({
        type: "say",
        text: "",
      }),
    ).toThrow();

    expect(() =>
      robotCommandPayloadSchema.parse({
        type: "say",
        text: "x".repeat(801),
      }),
    ).toThrow();
  });

  test("accept bridge ready responses", () => {
    expect(
      bridgeResponseSchema.parse({
        type: "ready",
        protocolVersion: bridgeProtocolVersion,
        implementation: "mock",
        mock: true,
      }),
    ).toEqual({
      type: "ready",
      protocolVersion: bridgeProtocolVersion,
      implementation: "mock",
      mock: true,
    });
  });
});
