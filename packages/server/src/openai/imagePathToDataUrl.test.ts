import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  imageMediaTypeFromPath,
  imagePathToDataUrl,
} from "@herbert/server/openai/imagePathToDataUrl";
import { describe, expect, test } from "bun:test";

describe("imageMediaTypeFromPath", () => {
  test("maps supported image extensions", () => {
    expect(imageMediaTypeFromPath({ path: "photo.jpg" })).toBe("image/jpeg");
    expect(imageMediaTypeFromPath({ path: "photo.jpeg" })).toBe("image/jpeg");
    expect(imageMediaTypeFromPath({ path: "photo.png" })).toBe("image/png");
    expect(imageMediaTypeFromPath({ path: "photo.webp" })).toBe("image/webp");
    expect(imageMediaTypeFromPath({ path: "photo.gif" })).toBe("image/gif");
  });

  test("rejects unsupported extensions", () => {
    expect(() => imageMediaTypeFromPath({ path: "photo.txt" })).toThrow(
      "Unsupported image extension",
    );
  });
});

describe("imagePathToDataUrl", () => {
  test("encodes image bytes as a data URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herbert-openai-"));
    const path = join(directory, "photo.png");

    try {
      await writeFile(path, Buffer.from([1, 2, 3]));

      const dataUrl = await imagePathToDataUrl({ path });

      expect(dataUrl).toBe("data:image/png;base64,AQID");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
