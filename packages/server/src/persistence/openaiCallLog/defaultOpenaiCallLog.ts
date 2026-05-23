import { createSqliteSqlClient } from "@herbert/server/persistence/createSqliteSqlClient";
import type { OpenaiCallLog } from "@herbert/server/persistence/openaiCallLog/openaiCallLog";
import { SqliteOpenaiCallLog } from "@herbert/server/persistence/openaiCallLog/SqliteOpenaiCallLog";

let log: OpenaiCallLog | undefined;

export function defaultOpenaiCallLog(): OpenaiCallLog {
  if (log !== undefined) {
    return log;
  }

  log = new SqliteOpenaiCallLog(createSqliteSqlClient());
  return log;
}
