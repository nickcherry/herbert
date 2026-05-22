import { telegramConfig } from "@herbert/server/constants/telegram";
import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { telegramMessageHistoryDocumentIdentity } from "@herbert/server/persistence/operations/telegramMessageHistory/historyDocument";
import { readTelegramMessageHistory } from "@herbert/server/persistence/operations/telegramMessageHistory/readTelegramMessageHistory";
import {
  type TelegramHistoryMessage,
  telegramMessageHistorySchema,
} from "@herbert/shared/telegramMessageHistory";

export interface AppendTelegramMessageHistoryBatchOptions {
  readonly chatId: string;
  readonly messages: readonly TelegramHistoryMessage[];
  readonly store?: DocumentStore;
}

/**
 * Appends a batch of authorized messages to the persisted history for a
 * chat, preserving the most-recent slice up to
 * `telegramConfig.openAIContextMessageLimit`.
 */
export async function appendTelegramMessageHistoryBatch({
  chatId,
  messages,
  store = defaultDocumentStore(),
}: AppendTelegramMessageHistoryBatchOptions): Promise<void> {
  const existingMessages = await readTelegramMessageHistory({ chatId, store });
  const nextMessages = [...existingMessages, ...messages].slice(
    -telegramConfig.openAIContextMessageLimit,
  );

  await store.write({
    ...telegramMessageHistoryDocumentIdentity({ chatId }),
    schema: telegramMessageHistorySchema,
    value: {
      messages: nextMessages,
    },
  });
}
