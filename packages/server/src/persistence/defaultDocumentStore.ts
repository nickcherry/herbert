import { createMysqlSqlClient } from "@herbert/server/persistence/createMysqlSqlClient";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { MySqlDocumentStore } from "@herbert/server/persistence/MySqlDocumentStore";

let documentStore: DocumentStore | undefined;

export function defaultDocumentStore(): DocumentStore {
  if (documentStore !== undefined) {
    return documentStore;
  }

  documentStore = new MySqlDocumentStore(createMysqlSqlClient());
  return documentStore;
}
