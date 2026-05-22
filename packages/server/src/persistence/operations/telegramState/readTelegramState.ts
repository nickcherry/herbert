import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { telegramStateDocumentIdentity } from "@herbert/server/persistence/operations/telegramState/stateDocument";
import {
  type TelegramState,
  telegramStateSchema,
} from "@herbert/shared/telegramState";

export interface ReadTelegramStateOptions {
  readonly store?: DocumentStore;
}

/**
 * Returns the persisted Telegram polling cursor / last-receive timestamp, or
 * an empty state when nothing has been written yet (e.g. first boot).
 */
export async function readTelegramState({
  store = defaultDocumentStore(),
}: ReadTelegramStateOptions = {}): Promise<TelegramState> {
  return (
    (await store.read({
      ...telegramStateDocumentIdentity,
      schema: telegramStateSchema,
    })) ?? {}
  );
}
