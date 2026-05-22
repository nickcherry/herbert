import { telegramConfig } from "@herbert/server/constants/telegram";
import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import type { TelegramMessage } from "@herbert/server/telegram/schemas";
import { z } from "zod";

export const telegramHistoryMessageSchema = z.object({
  messageId: z.number().int(),
  date: z.number().int().nonnegative(),
  text: z.string(),
  sender: z.string().min(1).default("unknown"),
});

export const telegramMessageHistorySchema = z.object({
  messages: z
    .array(telegramHistoryMessageSchema)
    .max(telegramConfig.openAIContextMessageLimit),
});

export type TelegramHistoryMessage = z.infer<
  typeof telegramHistoryMessageSchema
>;

export interface ReadTelegramMessageHistoryOptions {
  readonly chatId: string;
  readonly store?: DocumentStore;
}

export interface AppendTelegramMessageHistoryOptions {
  readonly chatId: string;
  readonly message: TelegramHistoryMessage;
  readonly store?: DocumentStore;
}

export interface AppendTelegramMessageHistoryBatchOptions {
  readonly chatId: string;
  readonly messages: readonly TelegramHistoryMessage[];
  readonly store?: DocumentStore;
}

export async function readTelegramMessageHistory({
  chatId,
  store = defaultDocumentStore(),
}: ReadTelegramMessageHistoryOptions): Promise<
  readonly TelegramHistoryMessage[]
> {
  const history = await store.read({
    ...telegramMessageHistoryDocument({ chatId }),
    schema: telegramMessageHistorySchema,
  });

  return history?.messages ?? [];
}

export function filterRecentTelegramMessages({
  messages,
  nowMs = Date.now(),
  maxAgeMs,
}: {
  readonly messages: readonly TelegramHistoryMessage[];
  readonly nowMs?: number;
  readonly maxAgeMs: number;
}): readonly TelegramHistoryMessage[] {
  const cutoffSeconds = Math.floor((nowMs - maxAgeMs) / 1_000);
  return messages.filter((message) => message.date >= cutoffSeconds);
}

export async function appendTelegramMessageHistory({
  chatId,
  message,
  store = defaultDocumentStore(),
}: AppendTelegramMessageHistoryOptions): Promise<void> {
  await appendTelegramMessageHistoryBatch({
    chatId,
    messages: [message],
    store,
  });
}

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
    ...telegramMessageHistoryDocument({ chatId }),
    schema: telegramMessageHistorySchema,
    value: {
      messages: nextMessages,
    },
  });
}

export function telegramHistoryMessageFromTelegram({
  message,
  text,
}: {
  readonly message: TelegramMessage;
  readonly text: string;
}): TelegramHistoryMessage {
  return telegramHistoryMessageSchema.parse({
    messageId: message.message_id,
    date: message.date,
    text,
    sender: senderNameFromTelegramMessage({ message }),
  });
}

function senderNameFromTelegramMessage({
  message,
}: {
  readonly message: TelegramMessage;
}): string {
  const from = message.from;
  const candidates = [
    from?.first_name,
    from?.username,
    message.chat.first_name,
    message.chat.username,
    message.chat.title,
    String(message.chat.id),
  ];

  return (
    candidates.find((candidate) => hasText(candidate))?.trim() ?? "unknown"
  );
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function telegramMessageHistoryDocument({
  chatId,
}: {
  readonly chatId: string;
}): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: "telegram_message_history",
    key: chatId,
  };
}
