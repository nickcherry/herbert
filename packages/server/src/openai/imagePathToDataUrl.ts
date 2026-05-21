import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export async function imagePathToDataUrl({
  path,
}: {
  readonly path: string;
}): Promise<string> {
  const mediaType = imageMediaTypeFromPath({ path });
  const bytes = await readFile(path);
  return `data:${mediaType};base64,${bytes.toString("base64")}`;
}

export function imageMediaTypeFromPath({
  path,
}: {
  readonly path: string;
}): string {
  const extension = extname(path).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  throw new Error(
    `Unsupported image extension for OpenAI prompt: ${extension}`,
  );
}
