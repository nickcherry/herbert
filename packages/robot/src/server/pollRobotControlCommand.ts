import { robotServerBasicAuthHeaders } from "@herbert/robot/server/basicAuth";
import {
  apiErrorResponseSchema,
  type RemoteControlQueuedCommand,
  robotControlNextPath,
  robotControlNextResponseSchema,
} from "@herbert/shared";

export interface PollRobotControlCommandOptions {
  readonly serverUrl: string;
}

export async function pollRobotControlCommand({
  serverUrl,
}: PollRobotControlCommandOptions): Promise<RemoteControlQueuedCommand | null> {
  const url = robotControlNextUrl({ serverUrl });
  const response = await fetchRobotControlNext({ url });
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: `robot control poll from ${url.href}`,
  });

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(payload);
    const message = error.success ? error.data.message : rawBody;
    throw new Error(
      `Robot control poll from ${url.href} failed with HTTP ${response.status}: ${message}`,
    );
  }

  return robotControlNextResponseSchema.parse(payload).command;
}

function robotControlNextUrl({
  serverUrl,
}: {
  readonly serverUrl: string;
}): URL {
  return new URL(robotControlNextPath, serverUrl);
}

async function fetchRobotControlNext({
  url,
}: {
  readonly url: URL;
}): Promise<Response> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, controlPollTimeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        ...robotServerBasicAuthHeaders(),
        accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to connect to Herbert server at ${url.href}: ${message}`,
      {
        cause: error,
      },
    );
  } finally {
    clearTimeout(timeout);
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

const controlPollTimeoutMs = 2_000;
