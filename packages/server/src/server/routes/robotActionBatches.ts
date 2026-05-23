import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { env } from "@herbert/server/constants/env";
import { persistenceConfig } from "@herbert/server/constants/persistence";
import { telegramConfig } from "@herbert/server/constants/telegram";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  filterRecentHerbertResponses,
  readHerbertResponseHistory,
} from "@herbert/server/persistence/operations/herbertResponseHistory";
import {
  claimNextRobotTaskBatch,
  completeRobotTaskBatch,
  recordRobotTaskBatchObservation,
} from "@herbert/server/persistence/operations/robotTaskQueue";
import {
  filterRecentTelegramMessages,
  readTelegramMessageHistory,
} from "@herbert/server/persistence/operations/telegramMessageHistory";
import { handleRobotTaskResponse } from "@herbert/server/robotTasks/handleRobotTaskResponse";
import { jsonResponse } from "@herbert/server/server/jsonResponse";
import {
  type DescribeTelegramBatchPhoto,
  describeTelegramBatchPhoto,
} from "@herbert/server/telegram/describeTelegramBatchPhoto";
import { promptTelegramOpenAI } from "@herbert/server/telegram/promptTelegramOpenAI";
import { sendTelegramMessage } from "@herbert/server/telegram/sendTelegramMessage";
import {
  type SendTelegramPhoto,
  sendTelegramPhoto,
} from "@herbert/server/telegram/sendTelegramPhoto";
import {
  robotActionBatchCompletePath,
  robotActionBatchPollPath,
  robotTaskActionBatchCompleteResponseSchema,
  robotTaskActionBatchPollResponseSchema,
  robotTaskCameraPositionSchema,
} from "@herbert/shared";

export const robotActionBatchPollRoutePath = robotActionBatchPollPath;
export const robotActionBatchCompleteRoutePath = robotActionBatchCompletePath;

export interface HandleRobotActionBatchPollRouteOptions {
  readonly request: Request;
  readonly store?: DocumentStore;
}

export interface HandleRobotActionBatchCompleteRouteOptions {
  readonly request: Request;
  readonly telegramBotToken?: string;
  readonly store?: DocumentStore;
  readonly sendMessage?: typeof sendTelegramMessage;
  readonly sendPhoto?: SendTelegramPhoto;
  readonly respondToMessage?: typeof promptTelegramOpenAI;
  readonly describeBatchPhoto?: DescribeTelegramBatchPhoto;
}

export async function handleRobotActionBatchPollRoute({
  request,
  store,
}: HandleRobotActionBatchPollRouteOptions): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(
      {
        ok: false,
        error: "method_not_allowed",
      },
      { status: 405 },
    );
  }

  const batch = await claimNextRobotTaskBatch({ store });
  return jsonResponse(
    robotTaskActionBatchPollResponseSchema.parse({
      ok: true,
      batch: batch ?? null,
    }),
  );
}

export async function handleRobotActionBatchCompleteRoute({
  request,
  telegramBotToken,
  store,
  sendMessage = sendTelegramMessage,
  sendPhoto = sendTelegramPhoto,
  respondToMessage = promptTelegramOpenAI,
  describeBatchPhoto = describeTelegramBatchPhoto,
}: HandleRobotActionBatchCompleteRouteOptions): Promise<Response> {
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

  const formDataResult = await readFormData({ request });
  if (formDataResult instanceof Response) {
    return formDataResult;
  }

  const batchId = requiredString(formDataResult.get("batchId"));
  const taskId = requiredString(formDataResult.get("taskId"));
  const cameraPositionResult = optionalCameraPosition({
    formData: formDataResult,
  });
  const distanceCmResult = optionalDistanceCm({ formData: formDataResult });
  const image = formDataResult.get("image");

  if (batchId === undefined || taskId === undefined) {
    return errorResponse({
      status: 400,
      error: "missing_batch_identity",
      message: "Expected multipart fields `batchId` and `taskId`.",
    });
  }

  if (cameraPositionResult instanceof Response) {
    return cameraPositionResult;
  }

  if (distanceCmResult instanceof Response) {
    return distanceCmResult;
  }

  if (!(image instanceof Blob)) {
    return errorResponse({
      status: 400,
      error: "missing_image",
      message: "Expected multipart field `image` containing a file.",
    });
  }

  try {
    const photoPath = await saveBatchPhoto({
      taskId,
      batchId,
      image,
    });
    const { batchReport, session } = await completeRobotTaskBatch({
      batchId,
      taskId,
      photoPath,
      cameraPosition: cameraPositionResult,
      distanceCm: distanceCmResult,
      store,
    });

    await sendPhoto({
      botToken: telegramBotToken,
      chatId: session.chatId,
      photo: image,
      filename: filenameForBlob({ blob: image }),
    });

    const observedSession = await maybeRecordBatchPhotoObservation({
      batchReport,
      describeBatchPhoto,
      session,
      store,
    });

    const recentMessages = filterRecentTelegramMessages({
      messages: await readTelegramMessageHistory({
        chatId: observedSession.chatId,
        store,
      }),
      maxAgeMs: telegramConfig.openAIContextMessageMaxAgeMs,
    });
    const recentHerbertResponses = filterRecentHerbertResponses({
      responses: await readHerbertResponseHistory({
        chatId: observedSession.chatId,
        store,
      }),
      maxAgeMs: telegramConfig.openAIContextMessageMaxAgeMs,
    });
    const response = await respondToMessage({
      chatId: observedSession.chatId,
      taskId: observedSession.id,
      recentMessages,
      newMessages: [],
      recentHerbertResponses,
      turnTrigger: "batch_complete",
      taskState: observedSession.taskState,
      batchReports: observedSession.batchReports,
      latestPhotoPath: photoPath,
    });

    await handleRobotTaskResponse({
      botToken: telegramBotToken,
      chatId: observedSession.chatId,
      response,
      store,
      sendMessage,
    });

    return jsonResponse(
      robotTaskActionBatchCompleteResponseSchema.parse({
        ok: true,
        accepted: true,
      }),
    );
  } catch (error) {
    return errorResponse({
      status: 500,
      error: "robot_batch_completion_failed",
      message: formatError(error),
    });
  }
}

async function maybeRecordBatchPhotoObservation({
  batchReport,
  describeBatchPhoto,
  session,
  store,
}: {
  readonly batchReport: Awaited<
    ReturnType<typeof completeRobotTaskBatch>
  >["batchReport"];
  readonly describeBatchPhoto: DescribeTelegramBatchPhoto;
  readonly session: Awaited<
    ReturnType<typeof completeRobotTaskBatch>
  >["session"];
  readonly store: DocumentStore | undefined;
}): Promise<Awaited<ReturnType<typeof completeRobotTaskBatch>>["session"]> {
  if (env.openaiApiKey === undefined) {
    return session;
  }

  try {
    const observation = await describeBatchPhoto({
      batchReport,
      taskState: session.taskState,
    });
    const result = await recordRobotTaskBatchObservation({
      taskId: session.id,
      batchId: batchReport.batchId,
      observation,
      store,
    });
    return result.session;
  } catch (error) {
    process.stderr.write(
      `batch photo observation failed: ${formatError(error)}\n`,
    );
    return session;
  }
}

async function saveBatchPhoto({
  taskId,
  batchId,
  image,
}: {
  readonly taskId: string;
  readonly batchId: string;
  readonly image: Blob;
}): Promise<string> {
  const directory = join(
    persistenceConfig.batchPhotoDirectory,
    safePathSegment(taskId),
  );
  const path = join(
    directory,
    `${safePathSegment(batchId)}-${filenameForBlob({ blob: image })}`,
  );

  await mkdir(directory, { recursive: true });
  await Bun.write(path, image);
  return path;
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
    return safePathSegment(basename(blob.name));
  }

  return "herbert-batch.jpg";
}

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalCameraPosition({
  formData,
}: {
  readonly formData: { get: (name: string) => unknown };
}): { readonly pan: number; readonly tilt: number } | Response | undefined {
  const pan = formData.get("cameraPan");
  const tilt = formData.get("cameraTilt");

  if (pan === null && tilt === null) {
    return undefined;
  }

  if (typeof pan !== "string" || typeof tilt !== "string") {
    return errorResponse({
      status: 400,
      error: "invalid_camera_position",
      message:
        "Expected `cameraPan` and `cameraTilt` multipart fields to be numeric strings when either is provided.",
    });
  }

  const result = robotTaskCameraPositionSchema.safeParse({
    pan: Number(pan),
    tilt: Number(tilt),
  });

  if (!result.success) {
    return errorResponse({
      status: 400,
      error: "invalid_camera_position",
      message: "Expected camera position angles within the supported range.",
    });
  }

  return result.data;
}

function optionalDistanceCm({
  formData,
}: {
  readonly formData: { get: (name: string) => unknown };
}): number | undefined | Response {
  const raw = formData.get("distanceCm");

  if (raw === null) {
    return undefined;
  }

  if (typeof raw !== "string") {
    return errorResponse({
      status: 400,
      error: "invalid_distance_cm",
      message: "Expected `distanceCm` multipart field to be a numeric string.",
    });
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return errorResponse({
      status: 400,
      error: "invalid_distance_cm",
      message: "Expected `distanceCm` to be a non-negative finite number.",
    });
  }

  return value;
}

function safePathSegment(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_.-]/g, "_");
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
