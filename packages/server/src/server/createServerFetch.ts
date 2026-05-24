import { jsonResponse } from "@herbert/server/server/jsonResponse";
import {
  createRemoteControlQueue,
  type RemoteControlQueue,
} from "@herbert/server/server/remoteControlQueue";
import {
  handlePingRoute,
  pingRoutePath,
} from "@herbert/server/server/routes/ping";
import {
  handleRobotControlNextRoute,
  handleRobotControlStatusRoute,
  handleWebControlCommandRoute,
  robotControlNextRoutePath,
  robotControlStatusRoutePath,
  webControlCommandRoutePath,
} from "@herbert/server/server/routes/robotControl";
import {
  handleRobotPhotosRoute,
  robotPhotosRoutePath,
} from "@herbert/server/server/routes/robotPhotos";
import {
  handleRobotVideoFrameRoute,
  handleVideoLatestFrameRoute,
  handleVideoMjpegRoute,
  handleVideoStatusRoute,
  robotVideoFrameRoutePath,
  videoLatestFrameRoutePath,
  videoMjpegRoutePath,
  videoStatusRoutePath,
} from "@herbert/server/server/routes/robotVideo";
import {
  handleVideoAppRoute,
  videoAppIndexRoutePath,
  videoAppRoutePath,
} from "@herbert/server/server/routes/videoApp";
import {
  createVideoFrameHub,
  type VideoFrameHub,
} from "@herbert/server/server/videoFrameHub";
import type { SendTelegramPhoto } from "@herbert/server/telegram/sendTelegramPhoto";

export interface CreateServerFetchOptions {
  readonly telegramBotToken?: string;
  readonly telegramAdminChatIds?: readonly string[];
  readonly sendTelegramPhoto?: SendTelegramPhoto;
  readonly videoFrameHub?: VideoFrameHub;
  readonly remoteControlQueue?: RemoteControlQueue;
}

export function createServerFetch({
  telegramBotToken,
  telegramAdminChatIds,
  sendTelegramPhoto,
  videoFrameHub = createVideoFrameHub(),
  remoteControlQueue = createRemoteControlQueue(),
}: CreateServerFetchOptions = {}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (
      url.pathname === videoAppRoutePath ||
      url.pathname === videoAppIndexRoutePath
    ) {
      return handleVideoAppRoute({ request });
    }

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

    if (url.pathname === webControlCommandRoutePath) {
      return await handleWebControlCommandRoute({
        request,
        queue: remoteControlQueue,
      });
    }

    if (url.pathname === robotControlNextRoutePath) {
      return handleRobotControlNextRoute({
        request,
        queue: remoteControlQueue,
      });
    }

    if (url.pathname === robotControlStatusRoutePath) {
      return handleRobotControlStatusRoute({
        request,
        queue: remoteControlQueue,
      });
    }

    if (url.pathname === robotVideoFrameRoutePath) {
      return await handleRobotVideoFrameRoute({
        request,
        hub: videoFrameHub,
      });
    }

    if (url.pathname === videoLatestFrameRoutePath) {
      return handleVideoLatestFrameRoute({
        request,
        hub: videoFrameHub,
      });
    }

    if (url.pathname === videoMjpegRoutePath) {
      return handleVideoMjpegRoute({
        request,
        hub: videoFrameHub,
      });
    }

    if (url.pathname === videoStatusRoutePath) {
      return handleVideoStatusRoute({
        request,
        hub: videoFrameHub,
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
