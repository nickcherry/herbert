import { parseKeyboardInput } from "@herbert/robot/keyboard/parseKeyboardInput";
import { describe, expect, test } from "bun:test";

const defaults = {
  speed: 35,
  turnAngle: 25,
  cameraStep: 5,
} as const;

describe("parseKeyboardInput", () => {
  test("maps arrow keys to drive pulses", () => {
    expect(
      parseKeyboardInput({
        input: "\u001b[A\u001b[D\u001b[B\u001b[C",
        ...defaults,
      }),
    ).toEqual([
      {
        type: "drive",
        motorSpeed: 35,
        steeringAngle: 0,
      },
      {
        type: "drive",
        motorSpeed: 35,
        steeringAngle: -25,
      },
      {
        type: "drive",
        motorSpeed: -35,
        steeringAngle: 0,
      },
      {
        type: "drive",
        motorSpeed: 35,
        steeringAngle: 25,
      },
    ]);
  });

  test("maps wasd to camera deltas", () => {
    expect(
      parseKeyboardInput({
        input: "wasd",
        ...defaults,
      }),
    ).toEqual([
      {
        type: "camera_delta",
        axis: "tilt",
        delta: 5,
      },
      {
        type: "camera_delta",
        axis: "pan",
        delta: -5,
      },
      {
        type: "camera_delta",
        axis: "tilt",
        delta: -5,
      },
      {
        type: "camera_delta",
        axis: "pan",
        delta: 5,
      },
    ]);
  });

  test("maps space, p, v, and q to controls", () => {
    expect(
      parseKeyboardInput({
        input: " pvq",
        ...defaults,
      }),
    ).toEqual([
      {
        type: "stop",
      },
      {
        type: "take_photo",
      },
      {
        type: "say",
        text: "hello from Herbert",
      },
      {
        type: "quit",
      },
    ]);
  });
});
