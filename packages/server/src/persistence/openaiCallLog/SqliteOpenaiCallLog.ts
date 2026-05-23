import { executeSql } from "@herbert/server/persistence/querySql";
import type { SqlClient, SqlRow, SqlValue } from "@herbert/server/persistence/sqlTypes";
import type {
  AppendOpenaiCallLogEntry,
  ListOpenaiCallLogFilters,
  OpenaiCallLog,
  OpenaiCallLogEntry,
} from "@herbert/server/persistence/openaiCallLog/openaiCallLog";
import { z } from "zod";

interface UnsafeCapableSql {
  readonly unsafe: (
    query: string,
    values?: readonly SqlValue[],
  ) => PromiseLike<readonly SqlRow[]>;
}

const rowSchema = z
  .object({
    id: z.string(),
    createdAtMs: z.number().int(),
    type: z.string(),
    model: z.string(),
    schemaName: z.string(),
    chatId: z.string().nullable(),
    taskId: z.string().nullable(),
    instructions: z.string().nullable(),
    prompt: z.string(),
    imagePathsJson: z.string(),
    responseJson: z.string().nullable(),
    errorMessage: z.string().nullable(),
    latencyMs: z.number().int(),
    inputTokens: z.number().int().nullable(),
    outputTokens: z.number().int().nullable(),
  })
  .strict();

export class SqliteOpenaiCallLog implements OpenaiCallLog {
  private initialized = false;

  public constructor(private readonly sql: SqlClient) {}

  public async append(
    entry: AppendOpenaiCallLogEntry,
  ): Promise<OpenaiCallLogEntry> {
    await this.ensureSchema();
    const id = generateEntryId({ createdAtMs: entry.createdAtMs });
    const imagePathsJson = JSON.stringify(entry.imagePaths);

    await executeSql({ sql: this.sql })`
      INSERT INTO openai_call_log (
        id,
        created_at_ms,
        type,
        model,
        schema_name,
        chat_id,
        task_id,
        instructions,
        prompt,
        image_paths_json,
        response_json,
        error_message,
        latency_ms,
        input_tokens,
        output_tokens
      ) VALUES (
        ${id},
        ${entry.createdAtMs},
        ${entry.type},
        ${entry.model},
        ${entry.schemaName},
        ${entry.chatId},
        ${entry.taskId},
        ${entry.instructions},
        ${entry.prompt},
        ${imagePathsJson},
        ${entry.responseJson},
        ${entry.errorMessage},
        ${entry.latencyMs},
        ${entry.inputTokens},
        ${entry.outputTokens}
      )
    `;

    return { ...entry, id };
  }

  public async list(
    filters: ListOpenaiCallLogFilters = {},
  ): Promise<readonly OpenaiCallLogEntry[]> {
    await this.ensureSchema();
    const limit = clampLimit(filters.limit);
    const where: string[] = [];
    const params: SqlValue[] = [];

    if (filters.type !== undefined) {
      where.push("type = ?");
      params.push(filters.type);
    }
    if (filters.chatId !== undefined) {
      where.push("chat_id = ?");
      params.push(filters.chatId);
    }
    if (filters.taskId !== undefined) {
      where.push("task_id = ?");
      params.push(filters.taskId);
    }
    if (filters.sinceMs !== undefined) {
      where.push("created_at_ms >= ?");
      params.push(filters.sinceMs);
    }

    const whereClause = where.length === 0 ? "" : ` WHERE ${where.join(" AND ")}`;
    const query = `
      SELECT
        id,
        created_at_ms AS createdAtMs,
        type,
        model,
        schema_name AS schemaName,
        chat_id AS chatId,
        task_id AS taskId,
        instructions,
        prompt,
        image_paths_json AS imagePathsJson,
        response_json AS responseJson,
        error_message AS errorMessage,
        latency_ms AS latencyMs,
        input_tokens AS inputTokens,
        output_tokens AS outputTokens
      FROM openai_call_log${whereClause}
      ORDER BY created_at_ms DESC, id DESC
      LIMIT ?
    `;

    const rawRows = await (this.sql as unknown as UnsafeCapableSql).unsafe(
      query,
      [...params, limit],
    );
    const rows = rowSchema.array().parse(rawRows);

    return rows.map((row) => ({
      id: row.id,
      createdAtMs: row.createdAtMs,
      type: row.type,
      model: row.model,
      schemaName: row.schemaName,
      chatId: row.chatId,
      taskId: row.taskId,
      instructions: row.instructions,
      prompt: row.prompt,
      imagePaths: parseImagePaths(row.imagePathsJson),
      responseJson: row.responseJson,
      errorMessage: row.errorMessage,
      latencyMs: row.latencyMs,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
    }));
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await executeSql({ sql: this.sql })`
      CREATE TABLE IF NOT EXISTS openai_call_log (
        id TEXT PRIMARY KEY,
        created_at_ms INTEGER NOT NULL,
        type TEXT NOT NULL,
        model TEXT NOT NULL,
        schema_name TEXT NOT NULL,
        chat_id TEXT,
        task_id TEXT,
        instructions TEXT,
        prompt TEXT NOT NULL,
        image_paths_json TEXT NOT NULL,
        response_json TEXT,
        error_message TEXT,
        latency_ms INTEGER NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER
      )
    `;
    await executeSql({ sql: this.sql })`
      CREATE INDEX IF NOT EXISTS openai_call_log_created_at_idx
        ON openai_call_log (created_at_ms)
    `;
    await executeSql({ sql: this.sql })`
      CREATE INDEX IF NOT EXISTS openai_call_log_type_created_at_idx
        ON openai_call_log (type, created_at_ms)
    `;
    await executeSql({ sql: this.sql })`
      CREATE INDEX IF NOT EXISTS openai_call_log_chat_id_created_at_idx
        ON openai_call_log (chat_id, created_at_ms)
    `;
    this.initialized = true;
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 50;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > 500) {
    return 500;
  }
  return Math.floor(limit);
}

function generateEntryId({ createdAtMs }: { readonly createdAtMs: number }): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${createdAtMs}_${suffix}`;
}

function parseImagePaths(json: string): readonly string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
    return [];
  }
  return parsed as readonly string[];
}
