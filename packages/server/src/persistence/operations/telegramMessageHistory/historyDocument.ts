const TELEGRAM_MESSAGE_HISTORY_COLLECTION = "telegram_message_history";

export function telegramMessageHistoryDocumentIdentity({
  chatId,
}: {
  readonly chatId: string;
}): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: TELEGRAM_MESSAGE_HISTORY_COLLECTION,
    key: chatId,
  };
}
