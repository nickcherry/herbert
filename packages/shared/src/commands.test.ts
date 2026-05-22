import {
  bridgeProtocolVersion,
  bridgeResponseSchema,
  robotCommandPayloadSchema,
  robotCommandSchema,
  robotTaskActionBatchSchema,
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

  test("accept queued robot action batches", () => {
    expect(
      robotTaskActionBatchSchema.parse({
        id: "batch-1",
        taskId: "task-1",
        actions: [
          {
            type: "drive",
            direction: "forward",
            speed: 25,
            durationMs: 250,
          },
          {
            type: "look",
            panDelta: 5,
            tiltDelta: 0,
          },
        ],
      }),
    ).toEqual({
      id: "batch-1",
      taskId: "task-1",
      actions: [
        {
          type: "drive",
          direction: "forward",
          speed: 25,
          durationMs: 250,
        },
        {
          type: "look",
          panDelta: 5,
          tiltDelta: 0,
        },
      ],
    });
  });
});
