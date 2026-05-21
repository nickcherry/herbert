import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { persistenceConfig } from "@herbert/server/constants/persistence";
import type { SqlClient } from "@herbert/server/persistence/sqlTypes";

export function createSqliteSqlClient({
  path = persistenceConfig.sqlitePath,
}: {
  readonly path?: string;
} = {}): SqlClient {
  const createSql = (Bun as unknown as BunSqlRuntime).SQL;

  if (createSql === undefined) {
    throw new Error("This Bun runtime does not expose Bun.SQL.");
  }

  const filename = resolve(path);
  mkdirSync(dirname(filename), { recursive: true });

  return createSql({ adapter: "sqlite", filename });
}

interface BunSqlRuntime {
  readonly SQL?: (options: {
    readonly adapter: "sqlite";
    readonly filename: string;
  }) => SqlClient;
}
