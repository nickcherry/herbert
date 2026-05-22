export function herbertResponseHistoryDocumentIdentity({
  chatId,
}: {
  readonly chatId: string;
}): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: "herbert_response_history",
    key: chatId,
  };
}
