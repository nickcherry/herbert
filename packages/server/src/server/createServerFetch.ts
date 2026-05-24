import { jsonResponse } from "@herbert/server/server/jsonResponse";
import {
  handlePingRoute,
  pingRoutePath,
} from "@herbert/server/server/routes/ping";
import {
  handleRobotPhotosRoute,
  robotPhotosRoutePath,
} from "@herbert/server/server/routes/robotPhotos";
import type { SendTelegramPhoto } from "@herbert/server/telegram/sendTelegramPhoto";

export interface CreateServerFetchOptions {
  readonly telegramBotToken?: string;
  readonly telegramAdminChatIds?: readonly string[];
  readonly sendTelegramPhoto?: SendTelegramPhoto;
}

export function createServerFetch({
  telegramBotToken,
  telegramAdminChatIds,
  sendTelegramPhoto,
}: CreateServerFetchOptions = {}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === pingRoutePath) {
      return handlePingRoute({ request });
    }

    if (url.pathname === robotPhotosRoutePath) {
      return await handleRobotPhotosRoute({
        request,
        telegramBotToken,
        telegramAdminChatIds,
        sendPhoto: sendTelegramPhoto,
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: "not_found",
      },
      { status: 404 },
    );
  };
}
