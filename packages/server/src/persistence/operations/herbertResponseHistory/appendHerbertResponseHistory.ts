import { telegramConfig } from "@herbert/server/constants/telegram";
import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { herbertResponseHistoryDocumentIdentity } from "@herbert/server/persistence/operations/herbertResponseHistory/historyDocument";
import { readHerbertResponseHistory } from "@herbert/server/persistence/operations/herbertResponseHistory/readHerbertResponseHistory";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import { herbertResponseHistorySchema } from "@herbert/shared/telegramMessageHistory";

export interface AppendHerbertResponseHistoryOptions {
  readonly chatId: string;
  readonly response: Pick<
    TelegramOpenAIResponse,
    "telegramMessage" | "spokenMessage"
  >;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

/**
 * Appends Herbert's outward Telegram/spoken text for a chat. Action-only turns
 * are not persisted because there is no text for the next prompt to remember.
 */
export async function appendHerbertResponseHistory({
  chatId,
  response,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: AppendHerbertResponseHistoryOptions): Promise<void> {
  if (response.telegramMessage === null && response.spokenMessage === null) {
    return;
  }

  const existingResponses = await readHerbertResponseHistory({ chatId, store });
  const nextResponses = [
    ...existingResponses,
    {
      createdAtMs: nowMs,
      telegramMessage: response.telegramMessage,
      spokenMessage: response.spokenMessage,
    },
  ].slice(-telegramConfig.openAIContextMessageLimit);

  await store.write({
    ...herbertResponseHistoryDocumentIdentity({ chatId }),
    schema: herbertResponseHistorySchema,
    value: {
      responses: nextResponses,
    },
  });
}
