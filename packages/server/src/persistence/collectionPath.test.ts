import { collectionPath } from "@herbert/server/persistence/collectionPath";
import { describe, expect, test } from "bun:test";

describe("collectionPath", () => {
  test("places collection files under runtime/collections", () => {
    expect(
      collectionPath({
        collection: "telegram_state",
        filename: "cursor.json",
      }),
    ).toBe("runtime/collections/telegram_state/cursor.json");
  });
});
