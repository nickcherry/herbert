import { nextSteeringAngle } from "@herbert/robot/keyboard/runKeyboardDrive";
import { describe, expect, test } from "bun:test";

describe("nextSteeringAngle", () => {
  test("applies steering deltas incrementally", () => {
    expect(nextSteeringAngle({ currentAngle: 0, delta: 5 })).toBe(5);
    expect(nextSteeringAngle({ currentAngle: 5, delta: 5 })).toBe(10);
    expect(nextSteeringAngle({ currentAngle: 10, delta: -5 })).toBe(5);
    expect(nextSteeringAngle({ currentAngle: 5, delta: -5 })).toBe(0);
    expect(nextSteeringAngle({ currentAngle: 0, delta: -5 })).toBe(-5);
  });

  test("clamps to steering limits", () => {
    expect(nextSteeringAngle({ currentAngle: 30, delta: 10 })).toBe(35);
    expect(nextSteeringAngle({ currentAngle: -30, delta: -10 })).toBe(-35);
  });
});
