import { existsSync } from "node:fs";

import { resolveRoomReferenceImages } from "@herbert/server/telegram/roomReferenceImages";
import { describe, expect, test } from "bun:test";

describe("resolveRoomReferenceImages", () => {
  test("resolves the prompt-ready room reference assets", () => {
    const images = resolveRoomReferenceImages();

    expect(images.map((image) => image.roomId)).toEqual([
      "living_dining",
      "kitchen",
      "master_bath",
      "bedroom_hall",
      "entrance",
      "master_bedroom",
      "office_bedroom",
    ]);
    expect(images[0]?.path).toContain(
      "packages/server/src/telegram/assets/generated/room-references/living-room.jpg",
    );
    for (const image of images) {
      expect(existsSync(image.path)).toBe(true);
    }
  });
});
