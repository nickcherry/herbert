import { readFile } from "node:fs/promises";

import { type z } from "zod";

export async function readJsonFile<Schema extends z.ZodType>({
  path,
  schema,
}: {
  readonly path: string;
  readonly schema: Schema;
}): Promise<z.infer<Schema> | undefined> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError({ error })) {
      return undefined;
    }

    throw error;
  }

  return schema.parse(JSON.parse(raw));
}

function isMissingFileError({ error }: { readonly error: unknown }): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
