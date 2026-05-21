import { z } from "zod";

export const telegramStateSchema = z.object({
  nextUpdateOffset: z.number().int().nonnegative().optional(),
  lastReceivedAtMs: z.number().int().nonnegative().optional(),
});

export type TelegramState = z.infer<typeof telegramStateSchema>;
