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
          steeringAngle: -5,
          distanceCm: 42.5,
          photoObservation: {
            summary: "A kitchen doorway is visible with open floor ahead.",
            targetProgress: "The stove is not visible yet.",
            navigableSpace: "Open floor continues through the doorway.",
            notableObjects: ["chair leg at far right"],
            distanceEstimates: [
              {
                subject: "chair leg at far right",
                category: "possible_blocker",
                distanceCm: 120,
                confidence: "low",
              },
            ],
            viewQuality: "partial",
            recommendedNextMove: "Drive through the doorway and re-shoot.",
          },
          actions: [{ type: "take_photo" }],
        },
      ],
      attachedImageCount: 1,
    });

    expect(prompt).toContain("<floorplan>");
    expect(prompt).not.toContain("<address>");
    expect(prompt).not.toContain("22 North 6th Street, Unit 10C");
    expect(prompt).toContain('<room number="1" name="Living / Dining Room"');
    expect(prompt).toContain('<room number="7"');
    expect(prompt).toContain("<turn_context>");
    expect(prompt).toContain("<trigger>telegram_messages</trigger>");
    expect(prompt).toContain("<new_message_count>2</new_message_count>");
    expect(prompt).toContain("<batch_report_count>1</batch_report_count>");
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
    expect(prompt).toContain(
      "<task_state>\nChecking whether the stove is on.\n</task_state>",
    );
    expect(prompt).toContain("<batch_reports>");
    expect(prompt).toContain("<batch_report>");
    expect(prompt).toContain("<attached_image>1</attached_image>");
    expect(prompt).toContain("<completed_actions>");
    expect(prompt).toContain("<camera_position>");
    expect(prompt).toContain("<pan>-10</pan>");
    expect(prompt).toContain("<tilt>25</tilt>");
    expect(prompt).toContain("<wheel_state>");
    expect(prompt).toContain("<steering_angle>-5</steering_angle>");
    expect(prompt).toContain(
      "<motor_state>stopped_at_batch_boundary</motor_state>",
    );
    expect(prompt).toContain(
      "<ultrasonic_distance_cm>42.5</ultrasonic_distance_cm>",
    );
    expect(prompt).not.toContain("<photo_observation>");
    expect(prompt).toContain(
      "<photo_path>data/robot-batch-photos/task/batch.jpg</photo_path>",
    );
  });

  test("includes stored photo observations for older batch reports", () => {
    const prompt = buildTelegramOpenAIPrompt({
      turnTrigger: "batch_complete",
      recentMessages: [],
      newMessages: [],
      batchReports: [
        {
          completedAtMs: 1_800_000_000_000,
          photoPath: "data/robot-batch-photos/task/older.jpg",
          photoObservation: {
            summary: "Window wall visible beyond sofa and table.",
            targetProgress: "The balcony window is visible but partly blocked.",
            navigableSpace: "Open floor extends toward the window side.",
            notableObjects: ["sofa foreground", "glass table frame"],
            distanceEstimates: [
              {
                subject: "balcony window",
                category: "target",
                distanceCm: 240,
                confidence: "medium",
              },
              {
                subject: "glass table frame",
                category: "possible_blocker",
                distanceCm: 55,
                confidence: "low",
              },
            ],
            viewQuality: "partial",
            recommendedNextMove: "Drive boldly toward the visible window side.",
          },
          actions: [{ type: "take_photo" }],
        },
        {
          completedAtMs: 1_800_000_001_000,
          photoPath: "data/robot-batch-photos/task/latest.jpg",
          photoObservation: {
            summary: "Latest description should not be used in lieu of image.",
            targetProgress: null,
            navigableSpace: "Unknown.",
            notableObjects: [],
            distanceEstimates: [],
            viewQuality: "poor",
            recommendedNextMove: null,
          },
          actions: [{ type: "take_photo" }],
        },
      ],
      attachedImageCount: 1,
    });

    expect(prompt).toContain("<attached_image>0</attached_image>");
    expect(prompt).toContain("<attached_image>1</attached_image>");
    expect(prompt).toContain("<photo_observation>");
    expect(prompt).toContain(
      "<summary>Window wall visible beyond sofa and table.</summary>",
    );
    expect(prompt).toContain(
      "<target_progress>The balcony window is visible but partly blocked.</target_progress>",
    );
    expect(prompt).toContain("<object>sofa foreground</object>");
    expect(prompt).toContain("<distance_estimates>");
    expect(prompt).toContain("<subject>balcony window</subject>");
    expect(prompt).toContain("<category>target</category>");
    expect(prompt).toContain("<distance_cm>240</distance_cm>");
    expect(prompt).toContain("<confidence>medium</confidence>");
    expect(prompt).toContain("<subject>glass table frame</subject>");
    expect(prompt).toContain("<view_quality>partial</view_quality>");
    expect(prompt).not.toContain("Latest description should not be used");
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
      "<task_state>\nChecking the stove from the kitchen doorway.\n</task_state>",
    );
  });

  test("renders task_state as 'none' when not provided", () => {
    const prompt = buildTelegramOpenAIPrompt({
      turnTrigger: "telegram_messages",
      recentMessages: [],
      newMessages: [],
      batchReports: [],
    });

    expect(prompt).toContain("<task_state>none</task_state>");
  });
});
