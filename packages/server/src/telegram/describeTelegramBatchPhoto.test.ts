import {
  telegramBatchPhotoObservationInstructions,
  telegramBatchPhotoObservationTypeScript,
} from "@herbert/server/telegram/describeTelegramBatchPhoto";
import { robotTaskBatchPhotoObservationOpenAISchema } from "@herbert/shared/robotTaskQueue";
import { describe, expect, test } from "bun:test";
import { zodTextFormat } from "openai/helpers/zod";

describe("telegramBatchPhotoObservationInstructions", () => {
  test("preserves turn-away route options instead of declaring clutter terminal", () => {
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "not stop conditions",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "do not trail off mid-thought",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "turn-away or arc-away reposition opportunity",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "Do not set recommendedNextMove to null",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "no floor/escape route is visible",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "distanceEstimates",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "approximate camera-to-subject distances in centimeters",
    );
    expect(telegramBatchPhotoObservationInstructions).toContain(
      "Use ultrasonic_distance_cm only as a clue",
    );
  });

  test("documents the structured observation response shape", () => {
    expect(telegramBatchPhotoObservationTypeScript).toContain(
      "type TelegramBatchPhotoObservation = {",
    );
    expect(telegramBatchPhotoObservationTypeScript).toContain(
      "distanceEstimates: Array<{",
    );
    expect(telegramBatchPhotoObservationTypeScript).toContain(
      'category: "target" | "route_marker" | "possible_blocker" | "landmark" | "other";',
    );
    expect(telegramBatchPhotoObservationTypeScript).toContain(
      "distanceCm: number | null;",
    );
  });

  test("sends distance estimates in the OpenAI structured schema", () => {
    const textFormat = zodTextFormat(
      robotTaskBatchPhotoObservationOpenAISchema,
      "telegram_batch_photo_observation",
    );
    const schemaJson = JSON.stringify(textFormat.schema);

    expect(schemaJson).toContain("distanceEstimates");
    expect(schemaJson).toContain("distanceCm");
    expect(schemaJson).toContain("category");
    expect(schemaJson).toContain("possible_blocker");
  });
});
