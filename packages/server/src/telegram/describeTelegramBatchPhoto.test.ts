import { telegramBatchPhotoObservationInstructions } from "@herbert/server/telegram/describeTelegramBatchPhoto";
import { describe, expect, test } from "bun:test";

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
  });
});
