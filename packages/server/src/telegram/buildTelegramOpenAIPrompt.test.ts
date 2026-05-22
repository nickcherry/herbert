import { buildTelegramOpenAIPrompt } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import { describe, expect, test } from "bun:test";

describe("buildTelegramOpenAIPrompt", () => {
  test("formats recent context and new messages as XML", () => {
    const prompt = buildTelegramOpenAIPrompt({
      turnTrigger: "telegram_messages",
      recentMessages: [
        {
          messageId: 1,
          date: 1_800_000_000,
          text: "what <can> you do?",
          sender: "Nick",
        },
      ],
      newMessages: [
        {
          messageId: 2,
          date: 1_800_000_010,
          text: "drive forward a little",
          sender: "Nick",
        },
        {
          messageId: 3,
          date: 1_800_000_011,
          text: "then take a photo",
          sender: "Frances",
        },
      ],
      taskState: "Checking whether the stove is on.",
      commentary: [
        {
          completedAtMs: 1_800_000_012_000,
          photoPath: "data/robot-commentary/task/batch.jpg",
          actions: [{ type: "take_photo" }],
        },
      ],
      hasAttachedImages: true,
    });

    expect(prompt).toContain("<turn_context>");
    expect(prompt).toContain("<trigger>telegram_messages</trigger>");
    expect(prompt).toContain("<new_message_count>2</new_message_count>");
    expect(prompt).toContain(
      "<robot_commentary_count>1</robot_commentary_count>",
    );
    expect(prompt).toContain(
      "<latest_image_attached>1</latest_image_attached>",
    );
    expect(prompt).toContain("<user_messages>");
    expect(prompt).toContain("<sender>Nick</sender>");
    expect(prompt).toContain("<sender>Frances</sender>");
    expect(prompt).toContain("<text>what &lt;can&gt; you do?</text>");
    expect(prompt).toContain("<timestamp>2027-01-15 08:00:00</timestamp>");
    expect(prompt).toContain("<is_new>0</is_new>");
    expect(prompt).toContain("<text>drive forward a little</text>");
    expect(prompt).toContain("<text>then take a photo</text>");
    expect(prompt).toContain("<is_new>1</is_new>");
    expect(prompt).toContain("Checking whether the stove is on.");
    expect(prompt).toContain("<robot_commentaries>");
    expect(prompt).toContain("<commentary>");
    expect(prompt).toContain("<completed_actions>");
    expect(prompt).toContain(
      "<photo_path>data/robot-commentary/task/batch.jpg</photo_path>",
    );
  });

  test("marks robot commentary turns that have no new messages", () => {
    const prompt = buildTelegramOpenAIPrompt({
      turnTrigger: "robot_commentary",
      recentMessages: [],
      newMessages: [],
      taskState: "Checking the stove from the kitchen doorway.",
      commentary: [],
      hasAttachedImages: true,
    });

    expect(prompt).toContain("<trigger>robot_commentary</trigger>");
    expect(prompt).toContain("<new_message_count>0</new_message_count>");
    expect(prompt).toContain(
      "If there are no new messages and the trigger is robot_commentary",
    );
  });
});
