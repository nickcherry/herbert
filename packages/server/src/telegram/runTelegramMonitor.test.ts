import { pollIntervalForState } from "@herbert/server/telegram/runTelegramMonitor";
import { describe, expect, test } from "bun:test";

describe("pollIntervalForState", () => {
  test("uses the cold interval before any message has been received", () => {
    expect(
      pollIntervalForState({
        state: {},
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_000,
      }),
    ).toBe(10_000);
  });

  test("uses the active interval inside the active window", () => {
    expect(
      pollIntervalForState({
        state: {
          lastReceivedAtMs: 90_000,
        },
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_000,
      }),
    ).toBe(2_000);
  });

  test("returns to the cold interval outside the active window", () => {
    expect(
      pollIntervalForState({
        state: {
          lastReceivedAtMs: 60_000,
        },
        coldPollIntervalMs: 10_000,
        activePollIntervalMs: 2_000,
        activePollWindowMs: 30_000,
        nowMs: 100_001,
      }),
    ).toBe(10_000);
  });
});
