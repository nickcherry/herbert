import { env } from "@herbert/server/constants/env";
import { createMysqlSqlClient } from "@herbert/server/persistence/createMysqlSqlClient";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { MySqlDocumentStore } from "@herbert/server/persistence/MySqlDocumentStore";

let documentStore: DocumentStore | undefined;

export function defaultDocumentStore(): DocumentStore {
  if (documentStore !== undefined) {
    return documentStore;
  }

  const mysqlUrl = env.mysqlUrl;

  if (mysqlUrl === undefined) {
    throw new Error("MYSQL_URL is not set in the environment.");
  }

  documentStore = new MySqlDocumentStore(
    createMysqlSqlClient({ url: mysqlUrl }),
  );
  return documentStore;
}
