import { jsonResponse } from "@herbert/server/server/jsonResponse";
import type {
  VideoFrame,
  VideoFrameHub,
} from "@herbert/server/server/videoFrameHub";
import {
  robotVideoFrameUploadPath,
  videoFrameUploadResponseSchema,
  videoLatestFramePath,
  videoMjpegPath,
  videoStatusPath,
  videoStatusResponseSchema,
} from "@herbert/shared";

export const robotVideoFrameRoutePath = robotVideoFrameUploadPath;
export const videoLatestFrameRoutePath = videoLatestFramePath;
export const videoMjpegRoutePath = videoMjpegPath;
export const videoStatusRoutePath = videoStatusPath;

export interface HandleRobotVideoFrameRouteOptions {
  readonly request: Request;
  readonly hub: VideoFrameHub;
}

export async function handleRobotVideoFrameRoute({
  request,
  hub,
}: HandleRobotVideoFrameRouteOptions): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use POST to upload robot video frames.",
    });
  }

  const contentType = contentTypeHeader({ request });
  if (contentType !== "image/jpeg") {
    return errorResponse({
      status: 415,
      error: "unsupported_media_type",
      message: "Expected Content-Type: image/jpeg.",
    });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) {
    return errorResponse({
      status: 400,
      error: "empty_frame",
      message: "Video frame body was empty.",
    });
  }

  if (body.byteLength > maxVideoFrameBytes) {
    return errorResponse({
      status: 413,
      error: "frame_too_large",
      message: `Video frame must be ${maxVideoFrameBytes} bytes or smaller.`,
    });
  }

  const capturedAtMs = optionalIntegerHeader({
    request,
    name: "x-herbert-captured-at-ms",
  });
  const width = optionalIntegerHeader({
    request,
    name: "x-herbert-frame-width",
  });
  const height = optionalIntegerHeader({
    request,
    name: "x-herbert-frame-height",
  });

  const frame = hub.publish({
    image: body,
    contentType,
    capturedAtMs,
    width,
    height,
  });

  return jsonResponse(
    videoFrameUploadResponseSchema.parse({
      ok: true,
      frameId: frame.id,
      receivedAtMs: frame.receivedAtMs,
      subscriberCount: hub.subscriberCount(),
    }),
  );
}

export function handleVideoLatestFrameRoute({
  request,
  hub,
}: {
  readonly request: Request;
  readonly hub: VideoFrameHub;
}): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use GET to read the latest robot video frame.",
    });
  }

  const frame = hub.latest();
  if (frame === undefined) {
    return errorResponse({
      status: 404,
      error: "no_video_frame",
      message: "No robot video frame has been received yet.",
    });
  }

  return new Response(request.method === "HEAD" ? undefined : frame.image, {
    headers: videoFrameHeaders({ frame }),
  });
}

export function handleVideoStatusRoute({
  request,
  hub,
}: {
  readonly request: Request;
  readonly hub: VideoFrameHub;
}): Response {
  if (request.method !== "GET") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use GET to read video status.",
    });
  }

  return jsonResponse(
    videoStatusResponseSchema.parse({
      ok: true,
      ...hub.status(),
    }),
  );
}

export function handleVideoMjpegRoute({
  request,
  hub,
}: {
  readonly request: Request;
  readonly hub: VideoFrameHub;
}): Response {
  if (request.method !== "GET") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use GET to read the MJPEG robot video stream.",
    });
  }

  let unsubscribe: (() => void) | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendFrame = (frame: VideoFrame): void => {
        try {
          controller.enqueue(mjpegHeaderChunk({ frame }));
          controller.enqueue(frame.image);
          controller.enqueue(crlfChunk);
        } catch {
          unsubscribe?.();
        }
      };

      const latest = hub.latest();
      if (latest !== undefined) {
        sendFrame(latest);
      }

      unsubscribe = hub.subscribe(sendFrame);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": `multipart/x-mixed-replace; boundary=${mjpegBoundary}`,
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

function contentTypeHeader({
  request,
}: {
  readonly request: Request;
}): "image/jpeg" | string {
  return request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
}

function optionalIntegerHeader({
  request,
  name,
}: {
  readonly request: Request;
  readonly name: string;
}): number | undefined {
  const raw = request.headers.get(name);
  if (raw === null) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function videoFrameHeaders({
  frame,
}: {
  readonly frame: VideoFrame;
}): Record<string, string> {
  return {
    "content-type": frame.contentType,
    "content-length": String(frame.image.byteLength),
    "cache-control": "no-store",
    "x-herbert-frame-id": String(frame.id),
    "x-herbert-received-at-ms": String(frame.receivedAtMs),
    ...(frame.capturedAtMs === undefined
      ? {}
      : { "x-herbert-captured-at-ms": String(frame.capturedAtMs) }),
    ...(frame.width === undefined
      ? {}
      : { "x-herbert-frame-width": String(frame.width) }),
    ...(frame.height === undefined
      ? {}
      : { "x-herbert-frame-height": String(frame.height) }),
  };
}

function mjpegHeaderChunk({
  frame,
}: {
  readonly frame: VideoFrame;
}): Uint8Array {
  return textEncoder.encode(
    [
      `--${mjpegBoundary}`,
      `Content-Type: ${frame.contentType}`,
      `Content-Length: ${frame.image.byteLength}`,
      `X-Herbert-Frame-Id: ${frame.id}`,
      `X-Herbert-Received-At-Ms: ${frame.receivedAtMs}`,
      frame.capturedAtMs === undefined
        ? undefined
        : `X-Herbert-Captured-At-Ms: ${frame.capturedAtMs}`,
      "",
      "",
    ]
      .filter((line) => line !== undefined)
      .join("\r\n"),
  );
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

const maxVideoFrameBytes = 5 * 1024 * 1024;
const mjpegBoundary = "herbert-video-frame";
const textEncoder = new TextEncoder();
const crlfChunk = textEncoder.encode("\r\n");
