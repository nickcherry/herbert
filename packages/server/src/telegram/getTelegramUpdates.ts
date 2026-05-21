import { parseJsonResponse } from "@herbert/server/telegram/parseJsonResponse";
import {
  telegramErrorSchema,
  telegramGetUpdatesSuccessSchema,
  type TelegramUpdate,
} from "@herbert/server/telegram/schemas";
import { telegramApiBaseUrl } from "@herbert/server/telegram/telegramApiBaseUrl";

export interface GetTelegramUpdatesParams {
  readonly botToken: string;
  readonly offset?: number;
  readonly timeoutSeconds: number;
  readonly limit: number;
  readonly signal?: AbortSignal;
}

export interface GetTelegramUpdatesResult {
  readonly updates: readonly TelegramUpdate[];
}

export async function getTelegramUpdates({
  botToken,
  offset,
  timeoutSeconds,
  limit,
  signal,
}: GetTelegramUpdatesParams): Promise<GetTelegramUpdatesResult> {
  const url = `${telegramApiBaseUrl}/bot${botToken}/getUpdates`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      ...(offset === undefined ? {} : { offset }),
      timeout: timeoutSeconds,
      limit,
      allowed_updates: ["message", "edited_message"],
    }),
  });

  const rawBody = await response.text();
  const payload = parseJsonResponse({
    rawBody,
    context: "Telegram getUpdates",
  });

  if (!response.ok) {
    const error = telegramErrorSchema.safeParse(payload);
    const description = error.success ? error.data.description : rawBody;
    throw new Error(
      `Telegram getUpdates failed with HTTP ${response.status}: ${description}`,
    );
  }

  const error = telegramErrorSchema.safeParse(payload);
  if (error.success) {
    throw new Error(`Telegram getUpdates failed: ${error.data.description}`);
  }

  const success = telegramGetUpdatesSuccessSchema.parse(payload);
  return { updates: success.result };
}
