import { parseJsonResponse } from "@herbert/server/telegram/parseJsonResponse";
import {
  telegramErrorSchema,
  telegramSendPhotoSuccessSchema,
} from "@herbert/server/telegram/schemas";
import { telegramApiBaseUrl } from "@herbert/server/telegram/telegramApiBaseUrl";

export interface SendTelegramPhotoParams {
  readonly botToken: string;
  readonly chatId: string;
  readonly photo: Blob;
  readonly filename: string;
  readonly caption?: string;
}

export interface SendTelegramPhotoResult {
  readonly messageId: number;
}

export type SendTelegramPhoto = (
  params: SendTelegramPhotoParams,
) => Promise<SendTelegramPhotoResult>;

export const sendTelegramPhoto: SendTelegramPhoto = async ({
  botToken,
  chatId,
  photo,
  filename,
  caption,
}: SendTelegramPhotoParams): Promise<SendTelegramPhotoResult> => {
  const url = `${telegramApiBaseUrl}/bot${botToken}/sendPhoto`;
  const formData = new FormData();
  formData.set("chat_id", chatId);
  formData.append("photo", photo, filename);

  if (caption !== undefined && caption.trim().length > 0) {
    formData.set("caption", caption);
  }

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  const rawBody = await response.text();
  const payload = parseJsonResponse({
    rawBody,
    context: "Telegram sendPhoto",
  });

  if (!response.ok) {
    const error = telegramErrorSchema.safeParse(payload);
    const description = error.success ? error.data.description : rawBody;
    throw new Error(
      `Telegram sendPhoto failed with HTTP ${response.status}: ${description}`,
    );
  }

  const error = telegramErrorSchema.safeParse(payload);
  if (error.success) {
    throw new Error(`Telegram sendPhoto failed: ${error.data.description}`);
  }

  const success = telegramSendPhotoSuccessSchema.parse(payload);
  return { messageId: success.result.message_id };
};
