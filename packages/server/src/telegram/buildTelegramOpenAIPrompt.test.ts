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
      recentHerbertResponses: [
        {
          createdAtMs: 1_800_000_005_000,
          telegramMessage: "I can scoot forward and inspect.",
          spokenMessage: "A modest reconnaissance, then.",
        },
      ],
      taskState: "Checking whether the stove is on.",
      batchReports: [
        {
          completedAtMs: 1_800_000_012_000,
          photoPath: "data/robot-batch-photos/task/batch.jpg",
          cameraPosition: { pan: -10, tilt: 25 },
          actions: [{ type: "take_photo" }],
        },
      ],
      attachedImageCount: 1,
    });

    expect(prompt).toContain("<turn_context>");
    expect(prompt).toContain("<trigger>telegram_messages</trigger>");
    expect(prompt).toContain("<new_message_count>2</new_message_count>");
    expect(prompt).toContain(
      "<batch_report_count>1</batch_report_count>",
    );
    expect(prompt).toContain("<attached_image_count>1</attached_image_count>");
    expect(prompt).toContain("<user_messages>");
    expect(prompt).toContain("<sender>Nick</sender>");
    expect(prompt).toContain("<sender>Frances</sender>");
    expect(prompt).toContain("<text>what &lt;can&gt; you do?</text>");
    expect(prompt).toContain("<timestamp>2027-01-15 08:00:00</timestamp>");
    expect(prompt).toContain("<is_new>0</is_new>");
    expect(prompt).toContain("<text>drive forward a little</text>");
    expect(prompt).toContain("<text>then take a photo</text>");
    expect(prompt).toContain("<is_new>1</is_new>");
    expect(prompt).toContain("<herbert_responses>");
    expect(prompt).toContain("<telegram_message>");
    expect(prompt).toContain("I can scoot forward and inspect.");
    expect(prompt).toContain("<spoken_message>");
    expect(prompt).toContain("A modest reconnaissance, then.");
    expect(prompt).toContain("Checking whether the stove is on.");
    expect(prompt).toContain("<batch_reports>");
    expect(prompt).toContain("<batch_report>");
    expect(prompt).toContain("<completed_actions>");
    expect(prompt).toContain("<camera_position>");
    expect(prompt).toContain("<pan>-10</pan>");
    expect(prompt).toContain("<tilt>25</tilt>");
    expect(prompt).toContain(
      "<photo_path>data/robot-batch-photos/task/batch.jpg</photo_path>",
    );
  });

  test("marks batch_complete turns that have no new messages", () => {
    const prompt = buildTelegramOpenAIPrompt({
      turnTrigger: "batch_complete",
      recentMessages: [],
      newMessages: [],
      taskState: "Checking the stove from the kitchen doorway.",
      batchReports: [],
      attachedImageCount: 1,
    });

    expect(prompt).toContain("<trigger>batch_complete</trigger>");
    expect(prompt).toContain("<new_message_count>0</new_message_count>");
    expect(prompt).toContain(
      "If there are no new messages and the trigger is batch_complete",
    );
  });
});
