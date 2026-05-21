import { parseKeyboardInput } from "@herbert/robot/keyboard/parseKeyboardInput";
import { describe, expect, test } from "bun:test";

const defaults = {
  speed: 35,
  turnAngle: 25,
  cameraStep: 5,
} as const;

describe("parseKeyboardInput", () => {
  test("maps up and down arrows to motor pulses", () => {
    expect(
      parseKeyboardInput({
        input: "\u001b[A\u001b[B",
        ...defaults,
      }),
    ).toEqual([
      {
        type: "motor",
        motorSpeed: 35,
      },
      {
        type: "motor",
        motorSpeed: -35,
      },
    ]);
  });

  test("maps left and right arrows to steering deltas only", () => {
    expect(
      parseKeyboardInput({
        input: "\u001b[D\u001b[C",
        ...defaults,
      }),
    ).toEqual([
      {
        type: "steering_delta",
        delta: -25,
      },
      {
        type: "steering_delta",
        delta: 25,
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
