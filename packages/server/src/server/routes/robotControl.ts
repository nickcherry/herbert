import { jsonResponse } from "@herbert/server/server/jsonResponse";
import type { RemoteControlQueue } from "@herbert/server/server/remoteControlQueue";
import {
  apiErrorResponseSchema,
  remoteControlCommandSchema,
  robotControlNextPath,
  robotControlNextResponseSchema,
  robotControlStatusPath,
  robotControlStatusResponseSchema,
  webControlCommandPath,
  webControlCommandResponseSchema,
} from "@herbert/shared";

export const webControlCommandRoutePath = webControlCommandPath;
export const robotControlNextRoutePath = robotControlNextPath;
export const robotControlStatusRoutePath = robotControlStatusPath;

export async function handleWebControlCommandRoute({
  request,
  queue,
}: {
  readonly request: Request;
  readonly queue: RemoteControlQueue;
}): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use POST to queue a robot control command.",
    });
  }

  const payload = await parseJsonBody({ request });
  if (!payload.ok) {
    return errorResponse({
      status: 400,
      error: "invalid_json",
      message: payload.message,
    });
  }

  const command = remoteControlCommandSchema.safeParse(payload.body);
  if (!command.success) {
    return errorResponse({
      status: 400,
      error: "invalid_control_command",
      message: command.error.message,
    });
  }

  const queuedCommand = queue.enqueue(command.data);

  return jsonResponse(
    webControlCommandResponseSchema.parse({
      ok: true,
      command: queuedCommand,
      queueDepth: queue.status().queueDepth,
    }),
  );
}

export function handleRobotControlNextRoute({
  request,
  queue,
}: {
  readonly request: Request;
  readonly queue: RemoteControlQueue;
}): Response {
  if (request.method !== "GET") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use GET to fetch the next robot control command.",
    });
  }

  return jsonResponse(
    robotControlNextResponseSchema.parse({
      ok: true,
      command: queue.next(),
    }),
  );
}

export function handleRobotControlStatusRoute({
  request,
  queue,
}: {
  readonly request: Request;
  readonly queue: RemoteControlQueue;
}): Response {
  if (request.method !== "GET") {
    return errorResponse({
      status: 405,
      error: "method_not_allowed",
      message: "Use GET to read robot control queue status.",
    });
  }

  return jsonResponse(
    robotControlStatusResponseSchema.parse({
      ok: true,
      ...queue.status(),
    }),
  );
}

async function parseJsonBody({
  request,
}: {
  readonly request: Request;
}): Promise<
  | {
      readonly ok: true;
      readonly body: unknown;
    }
  | {
      readonly ok: false;
      readonly message: string;
    }
> {
  try {
    return {
      ok: true,
      body: await request.json(),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Request body must be JSON: ${error.message}`
          : "Request body must be JSON.",
    };
  }
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
    apiErrorResponseSchema.parse({
      ok: false,
      error,
      message,
    }),
    { status },
  );
}
