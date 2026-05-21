import { z } from "zod";

/**
 * Wire format for a Telegram message body. `markdown` maps to Telegram's
 * legacy `Markdown` parse mode. Keep messages short and avoid characters that
 * need escaping unless formatting is actually useful.
 */
export const telegramMessageFormatSchema = z.enum(["plain", "markdown"]);

export const telegramChatSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const telegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  date: z.number(),
  chat: telegramChatSchema,
  from: telegramUserSchema.optional(),
  text: z.string().optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  edited_message: telegramMessageSchema.optional(),
});

export const telegramGetUpdatesSuccessSchema = z.object({
  ok: z.literal(true),
  result: z.array(telegramUpdateSchema),
});

/**
 * Successful sendMessage response shape. We only consume result.message_id.
 */
export const telegramSendMessageSuccessSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    message_id: z.number(),
  }),
});

export const telegramSendPhotoSuccessSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    message_id: z.number(),
  }),
});

/**
 * Telegram error envelope. Shows up on 4xx/5xx and sometimes on 200 with
 * `ok: false`.
 */
export const telegramErrorSchema = z.object({
  ok: z.literal(false),
  description: z.string(),
  error_code: z.number().optional(),
});

export type TelegramMessageFormat = z.infer<typeof telegramMessageFormatSchema>;
export type TelegramChat = z.infer<typeof telegramChatSchema>;
export type TelegramUser = z.infer<typeof telegramUserSchema>;
export type TelegramMessage = z.infer<typeof telegramMessageSchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
