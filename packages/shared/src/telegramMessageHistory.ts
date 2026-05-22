import { z } from "zod";

/**
 * Persisted entry shape inside the Telegram message history document.
 */
export const telegramHistoryMessageSchema = z.object({
  messageId: z.number().int(),
  date: z.number().int().nonnegative(),
  text: z.string(),
  sender: z.string().min(1).default("unknown"),
});

export type TelegramHistoryMessage = z.infer<
  typeof telegramHistoryMessageSchema
>;

/**
 * Persisted shape of the per-chat Telegram message history document. Stored
 * under `collection: telegram_message_history, key: <admin chat id>`.
 *
 * The slice limit is enforced by the operation that writes the document, not
 * by the schema, so the shape stays decoupled from server runtime config.
 */
export const telegramMessageHistorySchema = z.object({
  messages: z.array(telegramHistoryMessageSchema),
});

export type TelegramMessageHistory = z.infer<
  typeof telegramMessageHistorySchema
>;
