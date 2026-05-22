import { SqliteDocumentStore } from "@herbert/server/persistence/SqliteDocumentStore";
import type {
  SqlClient,
  SqlRow,
  SqlValue,
} from "@herbert/server/persistence/sqlTypes";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

const TestSchema = z.object({
  count: z.number(),
  name: z.string(),
});

describe("SqliteDocumentStore", () => {
  test("round trips typed JSON documents", async () => {
    const sql = createFakeSqlClient();
    const store = new SqliteDocumentStore(sql);

    await store.write({
      collection: "telegram_state",
      key: "cursor",
      schema: TestSchema,
      value: {
        count: 3,
        name: "herbert",
      },
    });

    const value = await store.read({
      collection: "telegram_state",
      key: "cursor",
      schema: TestSchema,
    });

    expect(value).toEqual({
      count: 3,
      name: "herbert",
    });
    expect(sql.createTableCount).toBe(1);
  });

  test("returns undefined for missing documents", async () => {
    const store = new SqliteDocumentStore(createFakeSqlClient());

    const value = await store.read({
      collection: "telegram_state",
      key: "missing",
      schema: TestSchema,
    });

    expect(value).toBeUndefined();
  });

  test("parses persisted data through the provided schema", async () => {
    const sql = createFakeSqlClient();
    sql.documents.set("telegram_state:cursor", {
      documentJson: JSON.stringify({ count: "bad" }),
    });
    const store = new SqliteDocumentStore(sql);

    let caughtError: unknown;

    try {
      await store.read({
        collection: "telegram_state",
        key: "cursor",
        schema: TestSchema,
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
  });

  test("parses SQL result rows before document parsing", async () => {
    const sql = createFakeSqlClient();
    sql.documents.set("telegram_state:cursor", { badAlias: "{}" });
    const store = new SqliteDocumentStore(sql);

    let caughtError: unknown;

    try {
      await store.read({
        collection: "telegram_state",
        key: "cursor",
        schema: TestSchema,
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
  });
});

interface FakeSqlClient extends SqlClient {
  documents: Map<string, SqlRow>;
  createTableCount: number;
}

function createFakeSqlClient(): FakeSqlClient {
  const documents = new Map<string, SqlRow>();

  const sql = (async (
    strings: TemplateStringsArray,
    ...values: readonly SqlValue[]
  ): Promise<readonly SqlRow[]> => {
    const text = strings.join("?");

    if (text.includes("CREATE TABLE")) {
      sql.createTableCount += 1;
      return [];
    }

    if (text.includes("SELECT document_json")) {
      const key = documentKeyFromSqlValues({ values });
      const row = documents.get(key);

      return row === undefined ? [] : [row];
    }

    if (text.includes("INSERT INTO herbert_documents")) {
      const key = documentKeyFromSqlValues({ values });
      const documentJson = values[2];

      if (typeof documentJson !== "string") {
        throw new Error("Expected document JSON to be a string.");
      }

      documents.set(key, { documentJson });
      return [];
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }) as unknown as FakeSqlClient;

  sql.documents = documents;
  sql.createTableCount = 0;
  return sql;
}

function documentKeyFromSqlValues({
  values,
}: {
  readonly values: readonly SqlValue[];
}): string {
  const collection = values[0];
  const key = values[1];

  if (typeof collection !== "string" || typeof key !== "string") {
    throw new Error("Expected collection and key SQL values to be strings.");
  }

  return `${collection}:${key}`;
}
