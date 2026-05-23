import { SqliteOpenaiCallLog } from "@herbert/server/persistence/openaiCallLog/SqliteOpenaiCallLog";
import type { SqlClient } from "@herbert/server/persistence/sqlTypes";
import { describe, expect, test } from "bun:test";

describe("SqliteOpenaiCallLog", () => {
  test("appends an entry and reads it back via list()", async () => {
    const log = new SqliteOpenaiCallLog(createInMemorySql());

    const appended = await log.append({
      createdAtMs: 1_700_000_000_000,
      type: "telegram_robot_turn",
      model: "gpt-5.5",
      schemaName: "telegram_robot_response",
      chatId: "123",
      taskId: null,
      instructions: "<role>...</role>",
      prompt: "<turn_context>...</turn_context>",
      imagePaths: ["/tmp/floorplan.jpg", "/tmp/batch1.jpg"],
      responseJson: '{"telegramMessage":"Right then."}',
      errorMessage: null,
      latencyMs: 1234,
      inputTokens: 4200,
      outputTokens: 350,
    });

    expect(appended.id).toMatch(/^1700000000000_/);
    expect(appended.type).toBe("telegram_robot_turn");

    const list = await log.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(appended.id);
    expect(list[0]?.imagePaths).toEqual(["/tmp/floorplan.jpg", "/tmp/batch1.jpg"]);
    expect(list[0]?.responseJson).toBe('{"telegramMessage":"Right then."}');
    expect(list[0]?.latencyMs).toBe(1234);
  });

  test("filters list() by type, chatId, taskId, and sinceMs", async () => {
    const log = new SqliteOpenaiCallLog(createInMemorySql());
    const base = 1_700_000_000_000;

    const sample = {
      model: "gpt-5.5",
      schemaName: "telegram_robot_response",
      instructions: null,
      prompt: "p",
      imagePaths: [],
      responseJson: null,
      errorMessage: null,
      latencyMs: 100,
      inputTokens: null,
      outputTokens: null,
    } as const;

    await log.append({ ...sample, createdAtMs: base, type: "telegram_robot_turn", chatId: "123", taskId: null });
    await log.append({ ...sample, createdAtMs: base + 1_000, type: "telegram_robot_turn", chatId: "456", taskId: "task-a" });
    await log.append({ ...sample, createdAtMs: base + 2_000, type: "other_kind", chatId: "123", taskId: null });
    await log.append({ ...sample, createdAtMs: base + 3_000, type: "telegram_robot_turn", chatId: "123", taskId: "task-b" });

    const byType = await log.list({ type: "telegram_robot_turn" });
    expect(byType.map((row) => row.createdAtMs)).toEqual([base + 3_000, base + 1_000, base]);

    const byChat = await log.list({ chatId: "123" });
    expect(byChat.map((row) => row.createdAtMs)).toEqual([base + 3_000, base + 2_000, base]);

    const byTask = await log.list({ taskId: "task-a" });
    expect(byTask.map((row) => row.createdAtMs)).toEqual([base + 1_000]);

    const since = await log.list({ sinceMs: base + 2_000 });
    expect(since.map((row) => row.createdAtMs)).toEqual([base + 3_000, base + 2_000]);

    const combined = await log.list({ type: "telegram_robot_turn", chatId: "123" });
    expect(combined.map((row) => row.createdAtMs)).toEqual([base + 3_000, base]);
  });

  test("records error entries with response_json null and an error message", async () => {
    const log = new SqliteOpenaiCallLog(createInMemorySql());

    await log.append({
      createdAtMs: 1_700_000_000_000,
      type: "telegram_robot_turn",
      model: "gpt-5.5",
      schemaName: "telegram_robot_response",
      chatId: null,
      taskId: null,
      instructions: null,
      prompt: "p",
      imagePaths: [],
      responseJson: null,
      errorMessage: "request_timeout",
      latencyMs: 30_000,
      inputTokens: null,
      outputTokens: null,
    });

    const [entry] = await log.list();
    expect(entry?.responseJson).toBeNull();
    expect(entry?.errorMessage).toBe("request_timeout");
  });
});

function createInMemorySql(): SqlClient {
  const createSql = (Bun as unknown as { readonly SQL: (options: { readonly adapter: "sqlite"; readonly filename: string }) => SqlClient }).SQL;
  return createSql({ adapter: "sqlite", filename: ":memory:" });
}
