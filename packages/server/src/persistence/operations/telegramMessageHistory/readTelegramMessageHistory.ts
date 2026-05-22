import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { telegramMessageHistoryDocumentIdentity } from "@herbert/server/persistence/operations/telegramMessageHistory/historyDocument";
import {
  type TelegramHistoryMessage,
  telegramMessageHistorySchema,
} from "@herbert/shared/telegramMessageHistory";

export interface ReadTelegramMessageHistoryOptions {
  readonly chatId: string;
  readonly store?: DocumentStore;
}

/**
 * Returns the persisted authorized text history for a chat, oldest first.
 * Returns an empty array when no history has been written yet.
 */
export async function readTelegramMessageHistory({
  chatId,
  store = defaultDocumentStore(),
}: ReadTelegramMessageHistoryOptions): Promise<
  readonly TelegramHistoryMessage[]
> {
  const history = await store.read({
    ...telegramMessageHistoryDocumentIdentity({ chatId }),
    schema: telegramMessageHistorySchema,
  });

  return history?.messages ?? [];
}
