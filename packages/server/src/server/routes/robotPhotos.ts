import { jsonResponse } from "@herbert/server/server/jsonResponse";
import {
  type SendTelegramPhoto,
  sendTelegramPhoto,
} from "@herbert/server/telegram/sendTelegramPhoto";
import {
  robotPhotoUploadPath,
  robotPhotoUploadResponseSchema,
} from "@herbert/shared";

export const robotPhotosRoutePath = robotPhotoUploadPath;

export interface HandleRobotPhotosRouteOptions {
  readonly request: Request;
  readonly telegramBotToken?: string;
  readonly telegramAdminChatIds?: readonly string[];
  readonly sendPhoto?: SendTelegramPhoto;
}

export async function handleRobotPhotosRoute({
  request,
  telegramBotToken,
  telegramAdminChatIds = [],
  sendPhoto = sendTelegramPhoto,
}: HandleRobotPhotosRouteOptions): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "method_not_allowed",
      },
      { status: 405 },
    );
  }

  if (telegramBotToken === undefined) {
    return errorResponse({
      status: 503,
      error: "telegram_not_configured",
      message: "TELEGRAM_BOT_TOKEN is not set.",
    });
  }

  if (telegramAdminChatIds.length === 0) {
    return errorResponse({
      status: 503,
      error: "telegram_not_configured",
      message: "TELEGRAM_ADMIN_CHAT_IDS is not set.",
    });
  }

  const formDataResult = await readFormData({ request });
  if (formDataResult instanceof Response) {
    return formDataResult;
  }

  const image = formDataResult.get("image");
  if (!(image instanceof Blob)) {
    return errorResponse({
      status: 400,
      error: "missing_image",
      message: "Expected multipart field `image` containing a file.",
    });
  }

  const sourcePath = optionalString(formDataResult.get("sourcePath"));
  const caption = sourcePath ? `Herbert photo\n${sourcePath}` : "Herbert photo";
  const filename = filenameForBlob({ blob: image });

  try {
    const results = await Promise.all(
      telegramAdminChatIds.map((chatId) =>
        sendPhoto({
          botToken: telegramBotToken,
          chatId,
          photo: image,
          filename,
          caption,
        }),
      ),
    );
    const response = robotPhotoUploadResponseSchema.parse({
      ok: true,
      messageIds: results.map((result) => result.messageId),
    });

    return jsonResponse(response);
  } catch (error) {
    return errorResponse({
      status: 502,
      error: "telegram_send_failed",
      message: formatError(error),
    });
  }
}

async function readFormData({ request }: { readonly request: Request }) {
  try {
    return await request.formData();
  } catch (error) {
    return errorResponse({
      status: 400,
      error: "invalid_multipart",
      message: formatError(error),
    });
  }
}

function filenameForBlob({ blob }: { readonly blob: Blob }): string {
  if (blob instanceof File && blob.name.trim().length > 0) {
    return blob.name;
  }

  return "herbert-photo.jpg";
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function errorResponse({
  status,
  error,
  message,
}: {
  readonly status: number;
  readonly error: string;
  readonly message: string;
}): Response {
  return jsonResponse(
    {
      ok: false,
      error,
      message,
    },
    { status },
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
