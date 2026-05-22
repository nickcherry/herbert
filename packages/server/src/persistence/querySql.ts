import type { SqlClient, SqlValue } from "@herbert/server/persistence/sqlTypes";
import { type z } from "zod";

export function executeSql({
  sql,
}: {
  readonly sql: SqlClient;
}): (
  strings: TemplateStringsArray,
  ...values: readonly SqlValue[]
) => Promise<void> {
  return async (
    strings: TemplateStringsArray,
    ...values: readonly SqlValue[]
  ): Promise<void> => {
    await sql(strings, ...values);
  };
}

export function querySql<Schema extends z.ZodType>({
  sql,
  rowSchema,
}: {
  readonly sql: SqlClient;
  readonly rowSchema: Schema;
}): (
  strings: TemplateStringsArray,
  ...values: readonly SqlValue[]
) => Promise<readonly z.infer<Schema>[]> {
  return async (
    strings: TemplateStringsArray,
    ...values: readonly SqlValue[]
  ): Promise<readonly z.infer<Schema>[]> => {
    const rows = await sql(strings, ...values);
    return rowSchema.array().parse(rows);
  };
}
