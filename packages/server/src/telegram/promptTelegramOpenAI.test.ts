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
    expect(telegramOpenAIInstructions).toContain("speed 100 for 3000ms");
  });

  test("biases toward bold movement instead of excessive caution", () => {
    expect(telegramOpenAIInstructions).toContain("clear floor");
    expect(telegramOpenAIInstructions).toContain("biased toward movement");
    expect(telegramOpenAIInstructions).toContain("drive boldly");
    expect(telegramOpenAIInstructions).toContain("partly obscured");
    expect(telegramOpenAIInstructions).toContain("absolute camera pan/tilt");
  });
});
