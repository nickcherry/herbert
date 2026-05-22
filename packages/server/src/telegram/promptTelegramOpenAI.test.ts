import { telegramOpenAIInstructions } from "@herbert/server/telegram/promptTelegramOpenAI";
import { describe, expect, test } from "bun:test";

describe("telegramOpenAIInstructions", () => {
  test("includes spoken commentary guidance", () => {
    expect(telegramOpenAIInstructions).toContain("800 characters");
    expect(telegramOpenAIInstructions).toContain("witticism");
    expect(telegramOpenAIInstructions).toContain("commentary on the room");
  });
});
