import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { herbertResponseHistoryDocumentIdentity } from "@herbert/server/persistence/operations/herbertResponseHistory/historyDocument";
import {
  type HerbertHistoryResponse,
  herbertResponseHistorySchema,
} from "@herbert/shared/telegramMessageHistory";

export interface ReadHerbertResponseHistoryOptions {
  readonly chatId: string;
  readonly store?: DocumentStore;
}

/**
 * Returns Herbert's persisted outward response history for a chat, oldest
 * first. Returns an empty array when no history has been written yet.
 */
export async function readHerbertResponseHistory({
  chatId,
  store = defaultDocumentStore(),
}: ReadHerbertResponseHistoryOptions): Promise<
  readonly HerbertHistoryResponse[]
> {
  const history = await store.read({
    ...herbertResponseHistoryDocumentIdentity({ chatId }),
    schema: herbertResponseHistorySchema,
  });

  return history?.responses ?? [];
}
