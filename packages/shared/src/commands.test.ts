import {
  bridgeProtocolVersion,
  bridgeResponseSchema,
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
