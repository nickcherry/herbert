import { z } from "zod";

/**
 * Persisted shape of the Telegram polling cursor document. Stored in SQLite
 * via the server document store under `collection: telegram_state, key: cursor`.
 */
export const telegramStateSchema = z.object({
  nextUpdateOffset: z.number().int().nonnegative().optional(),
  lastReceivedAtMs: z.number().int().nonnegative().optional(),
});

export type TelegramState = z.infer<typeof telegramStateSchema>;
