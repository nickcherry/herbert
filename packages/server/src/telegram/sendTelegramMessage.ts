import { parseJsonResponse } from "@herbert/server/telegram/parseJsonResponse";
import {
  telegramErrorSchema,
  type TelegramMessageFormat,
  telegramSendMessageSuccessSchema,
} from "@herbert/server/telegram/schemas";
import { telegramApiBaseUrl } from "@herbert/server/telegram/telegramApiBaseUrl";

export interface SendTelegramMessageParams {
  readonly botToken: string;
  readonly chatId: string;
  readonly text: string;
  readonly format?: TelegramMessageFormat;
}

export interface SendTelegramMessageResult {
  readonly messageId: number;
}

/**
 * Sends a single Telegram message via the Bot API. Validates the response
 * shape with Zod and throws a descriptive error when Telegram reports
 * `ok: false` or returns a non-2xx status.
 */
export async function sendTelegramMessage({
  botToken,
  chatId,
  text,
  format = "plain",
}: SendTelegramMessageParams): Promise<SendTelegramMessageResult> {
  if (text.trim().length === 0) {
    throw new Error("Telegram messages must contain non-empty text.");
  }

  const url = `${telegramApiBaseUrl}/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(format === "markdown" ? { parse_mode: "Markdown" } : {}),
    }),
  });

  const rawBody = await response.text();
  const payload = parseJsonResponse({
    rawBody,
    context: "Telegram sendMessage",
  });

  if (!response.ok) {
    const error = telegramErrorSchema.safeParse(payload);
    const description = error.success ? error.data.description : rawBody;
    throw new Error(
      `Telegram sendMessage failed with HTTP ${response.status}: ${description}`,
    );
  }

  const error = telegramErrorSchema.safeParse(payload);
  if (error.success) {
    throw new Error(`Telegram sendMessage failed: ${error.data.description}`);
  }

  const success = telegramSendMessageSuccessSchema.parse(payload);
  return { messageId: success.result.message_id };
}
