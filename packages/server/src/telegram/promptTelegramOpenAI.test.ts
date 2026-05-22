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

  test("forces bold movement via the schema floor and movement mandate", () => {
    expect(telegramOpenAIInstructions).toContain("<movement_mandate>");
    expect(telegramOpenAIInstructions).toContain("biased toward movement");
    expect(telegramOpenAIInstructions).toContain("There is no slow drive");
    expect(telegramOpenAIInstructions).toContain("There is no quick pulse");
    expect(telegramOpenAIInstructions).toContain("smallest legal drive is roughly 25 cm");
    expect(telegramOpenAIInstructions).toContain("partly obscured");
  });
});
