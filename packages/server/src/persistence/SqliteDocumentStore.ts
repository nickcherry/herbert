import {
  type DocumentStore,
  parseDocumentIdentity,
  type ReadDocumentOptions,
  type WriteDocumentOptions,
} from "@herbert/server/persistence/documentStore";
import { executeSql, querySql } from "@herbert/server/persistence/querySql";
import type { SqlClient } from "@herbert/server/persistence/sqlTypes";
import { z } from "zod";

const documentJsonRowSchema = z
  .object({
    documentJson: z.string(),
  })
  .strict();

export class SqliteDocumentStore implements DocumentStore {
  private initialized = false;

  public constructor(private readonly sql: SqlClient) {}

  public async read<Schema extends z.ZodType>({
    collection,
    key,
    schema,
  }: ReadDocumentOptions<Schema>): Promise<z.infer<Schema> | undefined> {
    const identity = parseDocumentIdentity({ collection, key });
    await this.ensureSchema();

    const rows = await querySql({
      sql: this.sql,
      rowSchema: documentJsonRowSchema,
    })`
      SELECT document_json AS documentJson
      FROM herbert_documents
      WHERE collection = ${identity.collection}
        AND document_key = ${identity.key}
      LIMIT 1
    `;
    const row = rows[0];

    if (row === undefined) {
      return undefined;
    }

    return schema.parse(parseDocumentJson(row.documentJson));
  }

  public async write<Schema extends z.ZodType>({
    collection,
    key,
    schema,
    value,
  }: WriteDocumentOptions<Schema>): Promise<void> {
    const identity = parseDocumentIdentity({ collection, key });
    const parsed = schema.parse(value);
    const documentJson = JSON.stringify(parsed);
    await this.ensureSchema();

    await executeSql({ sql: this.sql })`
      INSERT INTO herbert_documents (collection, document_key, document_json)
      VALUES (${identity.collection}, ${identity.key}, ${documentJson})
      ON CONFLICT(collection, document_key) DO UPDATE SET
        document_json = excluded.document_json,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await executeSql({ sql: this.sql })`
      CREATE TABLE IF NOT EXISTS herbert_documents (
        collection TEXT NOT NULL,
        document_key TEXT NOT NULL,
        document_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (collection, document_key)
      )
    `;
    this.initialized = true;
  }
}

function parseDocumentJson(value: string): unknown {
  return JSON.parse(value);
}
