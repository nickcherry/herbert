import { existsSync } from "node:fs";
import { relative } from "node:path";

import { resolveFloorplanImagePath } from "@herbert/server/telegram/resolveFloorplanImagePath";
import { describe, expect, test } from "bun:test";

describe("resolveFloorplanImagePath", () => {
  test("resolves the Telegram-owned floorplan asset", () => {
    const path = resolveFloorplanImagePath();

    expect(relative(process.cwd(), path)).toBe(
      "packages/server/src/telegram/assets/floorplan.jpg",
    );
    expect(existsSync(path)).toBe(true);
  });
});
