import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { telegramStateDocumentIdentity } from "@herbert/server/persistence/operations/telegramState/stateDocument";
import {
  type TelegramState,
  telegramStateSchema,
} from "@herbert/shared/telegramState";

export interface WriteTelegramStateOptions {
  readonly state: TelegramState;
  readonly store?: DocumentStore;
}

/**
 * Persists the Telegram polling cursor + last-receive timestamp. Called by
 * the polling loop after every update batch.
 */
export async function writeTelegramState({
  state,
  store = defaultDocumentStore(),
}: WriteTelegramStateOptions): Promise<void> {
  await store.write({
    ...telegramStateDocumentIdentity,
    schema: telegramStateSchema,
    value: state,
  });
}
