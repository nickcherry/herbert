import { telegramConfig } from "@herbert/server/constants/telegram";
import {
  buildTelegramOpenAIImages,
  telegramOpenAIInstructions,
} from "@herbert/server/telegram/promptTelegramOpenAI";
import { resolveFloorplanImagePath } from "@herbert/server/telegram/resolveFloorplanImagePath";
import { describe, expect, test } from "bun:test";

describe("telegramOpenAIInstructions", () => {
  test("organizes guidance into nested top-level XML sections", () => {
    for (const tag of [
      "<role>",
      "  <identity>",
      "  <voice>",
      "  <prime_directive>",
      "    <precision>",
      "    <show_requests>",
      "<physical_profile>",
      "  <dimensions>",
      "  <clearance>",
      "  <navigation_implication>",
      "<turn>",
      "  <triggers>",
      "  <state>",
      "    <images>",
      "      <floorplan>",
      "      <room_references>",
      "      <batch_photos>",
      "      <photo_observations>",
      "      <pose>",
      "<actions>",
      "  <inventory>",
      "  <limits>",
      "  <distance_estimates>",
      "  <composition>",
      "<movement_policy>",
      "  <pose_awareness>",
      "  <wheel_awareness>",
      "  <target_pursuit>",
      "  <bias>",
      "  <hazards>",
      "  <perspective>",
      "  <blockers>",
      "  <side_obstacle_escape>",
      "  <camera_only_limit>",
      "  <finish_bar>",
      "  <practical_limit>",
      "  <user_overrides>",
      "  <below_minimum_drive>",
      "<response>",
      "  <format>",
      "  <fields>",
      "  <action_requirement>",
      "<special_commands>",
    ]) {
      expect(telegramOpenAIInstructions).toContain(tag);
    }
  });

  test("requires precise, evidence-grounded answers and full-frame show shots", () => {
    expect(telegramOpenAIInstructions).toContain("thoroughly and precisely");
    expect(telegramOpenAIInstructions).toContain(
      "robot photos and batch reports actually present",
    );
    expect(telegramOpenAIInstructions).toContain(
      "floorplan only for static layout",
    );
    expect(telegramOpenAIInstructions).toContain("Do not guess");
    expect(telegramOpenAIInstructions).toContain("the deliverable is a photo");
    expect(telegramOpenAIInstructions).toContain("whole subject is captured");
  });

  test("describes floorplan grid and marked position context", () => {
    expect(telegramOpenAIInstructions).toContain("0-100 x/y grid");
    expect(telegramOpenAIInstructions).toContain("red dot");
    expect(telegramOpenAIInstructions).toContain("approximate context");
    expect(telegramOpenAIInstructions).toContain("floorplan_position");
    expect(telegramOpenAIInstructions).toContain("<room_references>");
    expect(telegramOpenAIInstructions).toContain(
      "static room reference photos",
    );
  });

  test("encodes the updated hard movement limits and a distance_estimates block", () => {
    expect(telegramOpenAIInstructions).toContain("<speed>50 to 100");
    expect(telegramOpenAIInstructions).toContain("<duration_ms>1000 to 5000");
    expect(telegramOpenAIInstructions).toContain("<distance_estimates>");
    expect(telegramOpenAIInstructions).toContain(
      "distance_cm ~= 50 * (speed / 100) * (durationMs / 1000)",
    );
    expect(telegramOpenAIInstructions).toContain("250 cm (maximum)");
  });

  test("describes action composition with drive_arc preference", () => {
    expect(telegramOpenAIInstructions).toContain("<composition>");
    expect(telegramOpenAIInstructions).toContain("prefer drive_arc");
    expect(telegramOpenAIInstructions).toContain("turn while moving");
    expect(telegramOpenAIInstructions).toContain(
      "Use take_photo only at the end",
    );
  });

  test("includes Herbert's physical size and clearance implications", () => {
    expect(telegramOpenAIInstructions).toContain("length 216 mm / 8.5 in");
    expect(telegramOpenAIInstructions).toContain("width 143 mm / 5.6 in");
    expect(telegramOpenAIInstructions).toContain("height 113 mm / 4.5 in");
    expect(telegramOpenAIInstructions).toContain(
      "fit under many chairs, coffee tables",
    );
    expect(telegramOpenAIInstructions).toContain("wheel-level path");
    expect(telegramOpenAIInstructions).toContain(
      "roughly 15 cm wide path plus a margin",
    );
  });

  test("pushes bold target pursuit instead of furniture paralysis", () => {
    expect(telegramOpenAIInstructions).toContain(
      "pursue it with chassis movement",
    );
    expect(telegramOpenAIInstructions).toContain("get physically closer");
    expect(telegramOpenAIInstructions).toContain(
      "speed 90-100 at 3000-5000 ms",
    );
    expect(telegramOpenAIInstructions).toContain(
      "Furniture legs, chair bases, table frames, plants, cords",
    );
    expect(telegramOpenAIInstructions).toContain(
      "move boldly around or past it",
    );
    expect(telegramOpenAIInstructions).toContain(
      "Turn or arc away from the side obstacle",
    );
    expect(telegramOpenAIInstructions).toContain(
      "the next batch MUST move the chassis",
    );
    expect(telegramOpenAIInstructions).toContain(
      "Objects look larger and closer",
    );
    expect(telegramOpenAIInstructions).toContain(
      "Do not set isFinished true for a show/look/photo target",
    );
  });

  test("distinguishes camera direction from body and wheel state", () => {
    expect(telegramOpenAIInstructions).toContain(
      "Do not confuse camera direction with chassis direction",
    );
    expect(telegramOpenAIInstructions).toContain("camera pan is far from 0");
    expect(telegramOpenAIInstructions).toContain("Use wheel_state");
    expect(telegramOpenAIInstructions).toContain(
      "At batch boundaries the motor is stopped",
    );
  });

  test("encodes the action-required-each-turn rule with its exceptions", () => {
    expect(telegramOpenAIInstructions).toContain("<action_requirement>");
    expect(telegramOpenAIInstructions).toContain(
      "Every turn MUST queue at least one action",
    );
    expect(telegramOpenAIInstructions).toContain("isFinished is true");
    expect(telegramOpenAIInstructions).toContain("blocking question");
    expect(telegramOpenAIInstructions).toContain(
      "set telegramMessage to null unless",
    );
  });

  test("requires JSON only and includes the exact TypeScript response shape", () => {
    expect(telegramOpenAIInstructions).toContain("Return JSON only");
    expect(telegramOpenAIInstructions).toContain(
      "type TelegramOpenAIResponse = {",
    );
    expect(telegramOpenAIInstructions).toContain(
      "telegramMessage: string | null;",
    );
    expect(telegramOpenAIInstructions).toContain("isFinished: boolean;");
    expect(telegramOpenAIInstructions).toContain('type: "drive_arc";');
    expect(telegramOpenAIInstructions).toContain("angle: number;");
    expect(telegramOpenAIInstructions).not.toContain("<telegram_message>");
    expect(telegramOpenAIInstructions).not.toContain("is_finished");
  });

  test("keeps spoken-message guidance terse and delay-aware", () => {
    expect(telegramOpenAIInstructions).toContain("<spokenMessage>");
    expect(telegramOpenAIInstructions).toContain("5-10 seconds");
    expect(telegramOpenAIInstructions).toContain("800 chars");
  });

  test("drops content that is not real functionality", () => {
    expect(telegramOpenAIInstructions).not.toContain("Summarize older history");
    expect(telegramOpenAIInstructions).not.toContain("Hedged language");
    expect(telegramOpenAIInstructions).not.toContain("Stepping BACK");
    expect(telegramOpenAIInstructions).not.toContain("ultrasonic_distance_cm");
    expect(telegramOpenAIInstructions).not.toContain("pompousness");
    expect(telegramOpenAIInstructions).not.toContain("Victorian theatre");
    expect(telegramOpenAIInstructions).not.toContain("smugness");
    expect(telegramOpenAIInstructions).not.toContain("anxiety");
    expect(telegramOpenAIInstructions).not.toContain("fussiness");
  });
});

describe("buildTelegramOpenAIImages", () => {
  test("attaches static references and only the latest batch photo when photo limit is one", () => {
    expect(telegramConfig.openAIBatchPhotoLimit).toBe(1);

    const images = buildTelegramOpenAIImages({
      batchReports: [
        {
          completedAtMs: 1,
          photoPath: "data/robot-batch-photos/task/older-1.jpg",
          actions: [{ type: "take_photo" }],
        },
        {
          completedAtMs: 2,
          photoPath: "data/robot-batch-photos/task/older-2.jpg",
          actions: [{ type: "take_photo" }],
        },
        {
          completedAtMs: 3,
          photoPath: "data/robot-batch-photos/task/latest.jpg",
          actions: [{ type: "take_photo" }],
        },
      ],
      latestPhotoPath: "data/robot-batch-photos/task/latest.jpg",
    });

    expect(images[0]?.path).toBe(resolveFloorplanImagePath());
    expect(images.slice(1, 8).map((image) => image.label)).toEqual([
      "Static room reference photo for roomId=living_dining (Living / Dining Room). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=kitchen (Kitchen). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=master_bath (Bathroom / Master Bath). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=bedroom_hall (Bedroom Hall). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=entrance (Entry / Kitchen / Office). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=master_bedroom (Master Bedroom). Use for visual room matching only; this is not Herbert's current view.",
      "Static room reference photo for roomId=office_bedroom (Office Bedroom). Use for visual room matching only; this is not Herbert's current view.",
    ]);
    expect(images.at(-1)?.path).toBe("data/robot-batch-photos/task/latest.jpg");
  });

  test("uses a marked floorplan when a position estimate is available", () => {
    const images = buildTelegramOpenAIImages({
      batchReports: [
        {
          completedAtMs: 1,
          photoPath: "data/robot-batch-photos/task/latest.jpg",
          photoObservation: {
            summary: "Window wall visible.",
            targetProgress: "The balcony window is visible.",
            navigableSpace: "Open floor leads toward the window.",
            notableObjects: ["sofa foreground"],
            distanceEstimates: [],
            floorplanPosition: {
              xPct: 69,
              yPct: 29,
              roomId: "living_dining",
              confidence: "medium",
              rationale:
                "The living room window wall matches the living dining room.",
            },
            viewQuality: "partial",
            recommendedNextMove: "Drive toward the window.",
          },
          actions: [{ type: "take_photo" }],
        },
      ],
      latestPhotoPath: "data/robot-batch-photos/task/latest.jpg",
      floorplanImagePathResolver({ position }) {
        expect(position?.xPct).toBe(69);
        expect(position?.yPct).toBe(29);
        return "tmp/marked-floorplan.png";
      },
    });

    expect(images[0]?.path).toBe("tmp/marked-floorplan.png");
    expect(images[0]?.label).toContain("red dot");
    expect(images[0]?.label).toContain("xPct=69");
  });
});
