import { buildTelegramOpenAIPrompt } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import { describe, expect, test } from "bun:test";

describe("buildTelegramOpenAIPrompt", () => {
  test("includes recent context and the current message separately", () => {
    const prompt = buildTelegramOpenAIPrompt({
      recentMessages: [
        {
          messageId: 1,
          date: 1_800_000_000,
          text: "what can you do?",
        },
      ],
      currentMessage: {
        messageId: 2,
        date: 1_800_000_010,
        text: "drive forward a little",
      },
    });

    expect(prompt).toContain("excluding the current message");
    expect(prompt).toContain('"messageId":1');
    expect(prompt).toContain('"text":"what can you do?"');
    expect(prompt).toContain("Current authorized Telegram message");
    expect(prompt).toContain('"messageId":2');
    expect(prompt).toContain('"text":"drive forward a little"');
  });
});
