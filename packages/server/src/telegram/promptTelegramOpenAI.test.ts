import { telegramOpenAIInstructions } from "@herbert/server/telegram/promptTelegramOpenAI";
import { describe, expect, test } from "bun:test";

describe("telegramOpenAIInstructions", () => {
  test("includes spoken commentary guidance", () => {
    expect(telegramOpenAIInstructions).toContain("800 characters");
    expect(telegramOpenAIInstructions).toContain("witticism");
    expect(telegramOpenAIInstructions).toContain("commentary on the room");
  });

  test("includes approximate drive distance guidance", () => {
    expect(telegramOpenAIInstructions).toContain("distance_cm");
    expect(telegramOpenAIInstructions).toContain("speed 50 for 1000ms");
  });

  test("encourages useful movement instead of excessive caution", () => {
    expect(telegramOpenAIInstructions).toContain("clear floor");
    expect(telegramOpenAIInstructions).toContain("Avoid micro-drive pulses");
    expect(telegramOpenAIInstructions).toContain("partly obscured");
    expect(telegramOpenAIInstructions).toContain("absolute camera pan/tilt");
  });
});
