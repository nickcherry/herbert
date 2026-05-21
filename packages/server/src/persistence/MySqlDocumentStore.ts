import {
  type DocumentStore,
  parseDocumentIdentity,
  type ReadDocumentOptions,
  type WriteDocumentOptions,
} from "@herbert/server/persistence/documentStore";
import type { SqlClient } from "@herbert/server/persistence/sqlTypes";
import { type z } from "zod";

export class MySqlDocumentStore implements DocumentStore {
  private initialized = false;

  public constructor(private readonly sql: SqlClient) {}

  public async read<Schema extends z.ZodType>({
    collection,
    key,
    schema,
  }: ReadDocumentOptions<Schema>): Promise<z.infer<Schema> | undefined> {
    const identity = parseDocumentIdentity({ collection, key });
    await this.ensureSchema();

    const rows = await this.sql`
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

    return schema.parse(parseDocumentJson({ value: row.documentJson }));
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

    await this.sql`
      INSERT INTO herbert_documents (collection, document_key, document_json)
      VALUES (${identity.collection}, ${identity.key}, ${documentJson})
      ON DUPLICATE KEY UPDATE document_json = ${documentJson}
    `;
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS herbert_documents (
        collection VARCHAR(128) NOT NULL,
        document_key VARCHAR(191) NOT NULL,
        document_json JSON NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (collection, document_key)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;
    this.initialized = true;
  }
}

function parseDocumentJson({ value }: { readonly value: unknown }): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }

  return value;
}
