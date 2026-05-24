import {
  apiErrorResponseSchema,
  robotVideoFrameUploadPath,
  type VideoFrameUploadResponse,
  videoFrameUploadResponseSchema,
} from "@herbert/shared";

export interface UploadRobotVideoFrameOptions {
  readonly serverUrl: string;
  readonly image: Uint8Array;
  readonly contentType: "image/jpeg";
  readonly capturedAtMs: number;
  readonly width: number;
  readonly height: number;
}

export async function uploadRobotVideoFrame({
  serverUrl,
  image,
  contentType,
  capturedAtMs,
  width,
  height,
}: UploadRobotVideoFrameOptions): Promise<VideoFrameUploadResponse> {
  const url = videoFrameUploadUrl({ serverUrl });
  const response = await fetchVideoFrameUpload({
    url,
    image,
    contentType,
    capturedAtMs,
    width,
    height,
  });
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: `robot video frame upload to ${url.href}`,
  });

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(payload);
    const message = error.success ? error.data.message : rawBody;
    throw new Error(
      `Video frame upload to ${url.href} failed with HTTP ${response.status}: ${message}`,
    );
  }

  return videoFrameUploadResponseSchema.parse(payload);
}

function videoFrameUploadUrl({
  serverUrl,
}: {
  readonly serverUrl: string;
}): URL {
  return new URL(robotVideoFrameUploadPath, serverUrl);
}

async function fetchVideoFrameUpload({
  url,
  image,
  contentType,
  capturedAtMs,
  width,
  height,
}: {
  readonly url: URL;
  readonly image: Uint8Array;
  readonly contentType: "image/jpeg";
  readonly capturedAtMs: number;
  readonly width: number;
  readonly height: number;
}): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "x-herbert-captured-at-ms": String(capturedAtMs),
        "x-herbert-frame-width": String(width),
        "x-herbert-frame-height": String(height),
      },
      body: image,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to connect to Herbert server at ${url.href}: ${message}`,
      {
        cause: error,
      },
    );
  }
}

function parseJsonPayload({
  rawBody,
  context,
}: {
  readonly rawBody: string;
  readonly context: string;
}): unknown {
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} returned invalid JSON: ${message}`, {
      cause: error,
    });
  }
}
