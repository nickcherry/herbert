import { imagePathToDataUrl } from "@herbert/server/openai/imagePathToDataUrl";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";

export interface BuildPromptInputContentOptions {
  readonly prompt: string;
  readonly imagePaths?: readonly string[];
}

export async function buildPromptInputContent({
  prompt,
  imagePaths = [],
}: BuildPromptInputContentOptions): Promise<ResponseInputMessageContentList> {
  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length === 0) {
    throw new Error("OpenAI prompt must be non-empty.");
  }

  const content: ResponseInputMessageContentList = [
    {
      type: "input_text",
      text: trimmedPrompt,
    },
  ];

  for (const imagePath of imagePaths) {
    content.push({
      type: "input_image",
      image_url: await imagePathToDataUrl({ path: imagePath }),
      detail: "auto",
    });
  }

  return content;
}
