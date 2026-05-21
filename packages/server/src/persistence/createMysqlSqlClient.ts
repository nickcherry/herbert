import type { SqlClient } from "@herbert/server/persistence/sqlTypes";

export function createMysqlSqlClient({
  url,
}: {
  readonly url: string;
}): SqlClient {
  const SqlConstructor = (Bun as unknown as BunSqlRuntime).SQL;

  if (SqlConstructor === undefined) {
    throw new Error("This Bun runtime does not expose Bun.SQL.");
  }

  return new SqlConstructor(url);
}

interface BunSqlRuntime {
  readonly SQL?: new (url: string) => SqlClient;
}
