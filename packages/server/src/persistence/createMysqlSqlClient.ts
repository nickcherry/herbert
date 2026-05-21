import type { SqlClient } from "@herbert/server/persistence/sqlTypes";

export function createMysqlSqlClient(): SqlClient {
  const createSql = (Bun as unknown as BunSqlRuntime).SQL;

  if (createSql === undefined) {
    throw new Error("This Bun runtime does not expose Bun.SQL.");
  }

  return createSql({ adapter: "mysql" });
}

interface BunSqlRuntime {
  readonly SQL?: (options: { readonly adapter: "mysql" }) => SqlClient;
}
