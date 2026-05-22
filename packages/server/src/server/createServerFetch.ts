import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { jsonResponse } from "@herbert/server/server/jsonResponse";
import {
  handlePingRoute,
  pingRoutePath,
} from "@herbert/server/server/routes/ping";
import {
  handleRobotActionBatchCompleteRoute,
  handleRobotActionBatchPollRoute,
  robotActionBatchCompleteRoutePath,
  robotActionBatchPollRoutePath,
} from "@herbert/server/server/routes/robotActionBatches";
import {
  handleRobotPhotosRoute,
  robotPhotosRoutePath,
} from "@herbert/server/server/routes/robotPhotos";
import { type promptTelegramOpenAI } from "@herbert/server/telegram/promptTelegramOpenAI";
import type { sendTelegramMessage } from "@herbert/server/telegram/sendTelegramMessage";
import type { SendTelegramPhoto } from "@herbert/server/telegram/sendTelegramPhoto";

export interface CreateServerFetchOptions {
  readonly telegramBotToken?: string;
  readonly telegramAdminChatIds?: readonly string[];
  readonly sendTelegramPhoto?: SendTelegramPhoto;
  readonly sendTelegramMessage?: typeof sendTelegramMessage;
  readonly respondToTelegramMessage?: typeof promptTelegramOpenAI;
  readonly store?: DocumentStore;
}

export function createServerFetch({
  telegramBotToken,
  telegramAdminChatIds,
  sendTelegramPhoto,
  sendTelegramMessage,
  respondToTelegramMessage,
  store,
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

    if (url.pathname === robotActionBatchPollRoutePath) {
      return await handleRobotActionBatchPollRoute({
        request,
        store,
      });
    }

    if (url.pathname === robotActionBatchCompleteRoutePath) {
      return await handleRobotActionBatchCompleteRoute({
        request,
        telegramBotToken,
        store,
        sendMessage: sendTelegramMessage,
        sendPhoto: sendTelegramPhoto,
        respondToMessage: respondToTelegramMessage,
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
