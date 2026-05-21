import { buildTelegramOpenAIPrompt } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import { describe, expect, test } from "bun:test";

describe("buildTelegramOpenAIPrompt", () => {
  test("formats recent context and new messages as XML", () => {
    const prompt = buildTelegramOpenAIPrompt({
      recentMessages: [
        {
          messageId: 1,
          date: 1_800_000_000,
          text: "what <can> you do?",
        },
      ],
      newMessages: [
        {
          messageId: 2,
          date: 1_800_000_010,
          text: "drive forward a little",
        },
        {
          messageId: 3,
          date: 1_800_000_011,
          text: "then take a photo",
        },
      ],
    });

    expect(prompt).toContain("<user_messages>");
    expect(prompt).toContain("<text>what &lt;can&gt; you do?</text>");
    expect(prompt).toContain("<timestamp>2027-01-15 08:00:00</timestamp>");
    expect(prompt).toContain("<is_new>0</is_new>");
    expect(prompt).toContain("<text>drive forward a little</text>");
    expect(prompt).toContain("<text>then take a photo</text>");
    expect(prompt).toContain("<is_new>1</is_new>");
  });
});
