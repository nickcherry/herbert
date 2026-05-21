import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readJsonFile } from "@herbert/server/persistence/readJsonFile";
import { writeJsonFile } from "@herbert/server/persistence/writeJsonFile";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

const TestSchema = z.object({
  value: z.number().int(),
});

describe("typed JSON persistence", () => {
  test("round trips values through zod schemas", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herbert-persist-"));
    const path = join(directory, "state.json");

    try {
      await writeJsonFile({
        path,
        schema: TestSchema,
        value: {
          value: 42,
        },
      });

      const value = await readJsonFile({ path, schema: TestSchema });

      expect(value).toEqual({
        value: 42,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("returns undefined for missing files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herbert-persist-"));

    try {
      const value = await readJsonFile({
        path: join(directory, "missing.json"),
        schema: TestSchema,
      });

      expect(value).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
