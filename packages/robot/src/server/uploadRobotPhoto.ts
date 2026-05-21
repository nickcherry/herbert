import { basename } from "node:path";

import {
  apiErrorResponseSchema,
  robotPhotoUploadPath,
  type RobotPhotoUploadResponse,
  robotPhotoUploadResponseSchema,
} from "@herbert/shared";

export interface UploadRobotPhotoOptions {
  readonly serverUrl: string;
  readonly path: string;
}

export async function uploadRobotPhoto({
  serverUrl,
  path,
}: UploadRobotPhotoOptions): Promise<RobotPhotoUploadResponse> {
  const url = photoUploadUrl({ serverUrl });
  const photo = Bun.file(path);

  if (!(await photo.exists())) {
    throw new Error(`Photo does not exist: ${path}`);
  }

  const formData = new FormData();
  formData.append("image", photo, basename(path));
  formData.set("sourcePath", path);

  const response = await fetchPhotoUpload({ url, formData });
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: `robot photo upload to ${url.href}`,
  });

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(payload);
    const message = error.success ? error.data.message : rawBody;
    throw new Error(
      `Photo upload to ${url.href} failed with HTTP ${response.status}: ${message}`,
    );
  }

  return robotPhotoUploadResponseSchema.parse(payload);
}

function photoUploadUrl({ serverUrl }: { readonly serverUrl: string }): URL {
  return new URL(robotPhotoUploadPath, serverUrl);
}

async function fetchPhotoUpload({
  url,
  formData,
}: {
  readonly url: URL;
  readonly formData: FormData;
}): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      body: formData,
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
