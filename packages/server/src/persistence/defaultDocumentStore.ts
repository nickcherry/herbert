import { createSqliteSqlClient } from "@herbert/server/persistence/createSqliteSqlClient";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { SqliteDocumentStore } from "@herbert/server/persistence/SqliteDocumentStore";

let documentStore: DocumentStore | undefined;

export function defaultDocumentStore(): DocumentStore {
  if (documentStore !== undefined) {
    return documentStore;
  }

  documentStore = new SqliteDocumentStore(createSqliteSqlClient());
  return documentStore;
}
