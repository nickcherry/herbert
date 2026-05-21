import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { type z } from "zod";

export async function writeJsonFile<Schema extends z.ZodType>({
  path,
  schema,
  value,
}: {
  readonly path: string;
  readonly schema: Schema;
  readonly value: z.input<Schema>;
}): Promise<void> {
  const parsed = schema.parse(value);
  const directory = dirname(path);
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}
