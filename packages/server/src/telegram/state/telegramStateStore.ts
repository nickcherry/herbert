import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  type TelegramState,
  telegramStateSchema,
} from "@herbert/server/telegram/state/telegramState";

const telegramStateDocument = {
  collection: "telegram_state",
  key: "cursor",
} as const;

export async function readTelegramState({
  store = defaultDocumentStore(),
}: {
  readonly store?: DocumentStore;
} = {}): Promise<TelegramState> {
  return (
    (await store.read({
      ...telegramStateDocument,
      schema: telegramStateSchema,
    })) ?? {}
  );
}

export async function writeTelegramState({
  state,
  store = defaultDocumentStore(),
}: {
  readonly state: TelegramState;
  readonly store?: DocumentStore;
}): Promise<void> {
  await store.write({
    ...telegramStateDocument,
    schema: telegramStateSchema,
    value: state,
  });
}
