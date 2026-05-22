import { imagePathToDataUrl } from "@herbert/server/openai/imagePathToDataUrl";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";

export type PromptImageDetail = "auto" | "low" | "high";

export interface PromptImageInput {
  readonly path: string;
  readonly detail?: PromptImageDetail;
  readonly label?: string;
}

export interface BuildPromptInputContentOptions {
  readonly prompt: string;
  readonly imagePaths?: readonly string[];
  readonly images?: readonly PromptImageInput[];
}

export async function buildPromptInputContent({
  prompt,
  imagePaths,
  images,
}: BuildPromptInputContentOptions): Promise<ResponseInputMessageContentList> {
  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length === 0) {
    throw new Error("OpenAI prompt must be non-empty.");
  }

  const resolvedImages: readonly PromptImageInput[] =
    images ?? (imagePaths ?? []).map((path) => ({ path }));

  const content: ResponseInputMessageContentList = [
    {
      type: "input_text",
      text: trimmedPrompt,
    },
  ];

  for (const image of resolvedImages) {
    if (image.label !== undefined && image.label.trim().length > 0) {
      content.push({
        type: "input_text",
        text: image.label,
      });
    }
    content.push({
      type: "input_image",
      image_url: await imagePathToDataUrl({ path: image.path }),
      detail: image.detail ?? "auto",
    });
  }

  return content;
}
