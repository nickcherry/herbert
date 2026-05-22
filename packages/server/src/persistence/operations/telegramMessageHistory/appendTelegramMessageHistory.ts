import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { appendTelegramMessageHistoryBatch } from "@herbert/server/persistence/operations/telegramMessageHistory/appendTelegramMessageHistoryBatch";
import type { TelegramHistoryMessage } from "@herbert/shared/telegramMessageHistory";

export interface AppendTelegramMessageHistoryOptions {
  readonly chatId: string;
  readonly message: TelegramHistoryMessage;
  readonly store?: DocumentStore;
}

/**
 * Convenience wrapper around `appendTelegramMessageHistoryBatch` for a single
 * message. Same slice / persistence semantics.
 */
export async function appendTelegramMessageHistory({
  chatId,
  message,
  store,
}: AppendTelegramMessageHistoryOptions): Promise<void> {
  await appendTelegramMessageHistoryBatch({
    chatId,
    messages: [message],
    store,
  });
}
