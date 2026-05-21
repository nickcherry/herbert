import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPromptInputContent } from "@herbert/server/openai/buildPromptInputContent";
import { describe, expect, test } from "bun:test";

describe("buildPromptInputContent", () => {
  test("builds text-only prompt content", async () => {
    const content = await buildPromptInputContent({
      prompt: "  summarize this  ",
    });

    expect(content).toEqual([
      {
        type: "input_text",
        text: "summarize this",
      },
    ]);
  });

  test("builds text plus image prompt content", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herbert-openai-"));
    const path = join(directory, "photo.jpg");

    try {
      await writeFile(path, Buffer.from([4, 5, 6]));

      const content = await buildPromptInputContent({
        prompt: "what is in this image?",
        imagePaths: [path],
      });

      expect(content).toEqual([
        {
          type: "input_text",
          text: "what is in this image?",
        },
        {
          type: "input_image",
          image_url: "data:image/jpeg;base64,BAUG",
          detail: "auto",
        },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects empty prompts", async () => {
    try {
      await buildPromptInputContent({
        prompt: "  ",
      });
      throw new Error("expected buildPromptInputContent to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw error;
      }
      expect(error.message).toBe("OpenAI prompt must be non-empty.");
    }
  });
});
