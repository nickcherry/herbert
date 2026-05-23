import { basename } from "node:path";

import {
  apiErrorResponseSchema,
  robotActionBatchCompletePath,
  robotActionBatchFailPath,
  robotActionBatchPollPath,
  type RobotTaskActionBatch,
  type RobotTaskActionBatchCompleteResponse,
  robotTaskActionBatchCompleteResponseSchema,
  type RobotTaskActionBatchFailResponse,
  robotTaskActionBatchFailResponseSchema,
  robotTaskActionBatchPollResponseSchema,
  type RobotTaskCameraPosition,
} from "@herbert/shared";

export interface PollRobotActionBatchOptions {
  readonly serverUrl: string;
}

export interface CompleteRobotActionBatchOptions {
  readonly serverUrl: string;
  readonly batch: RobotTaskActionBatch;
  readonly photoPath: string;
  readonly cameraPosition?: RobotTaskCameraPosition;
  readonly steeringAngle?: number;
  readonly distanceCm?: number | null;
}

export interface FailRobotActionBatchOptions {
  readonly serverUrl: string;
  readonly batch: RobotTaskActionBatch;
  readonly errorMessage: string;
}

export async function pollRobotActionBatch({
  serverUrl,
}: PollRobotActionBatchOptions): Promise<RobotTaskActionBatch | undefined> {
  const response = await fetch(actionBatchPollUrl({ serverUrl }));
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: "robot action batch poll",
  });

  if (!response.ok) {
    throw apiError({ payload, rawBody, response, context: "Action poll" });
  }

  return (
    robotTaskActionBatchPollResponseSchema.parse(payload).batch ?? undefined
  );
}

export async function completeRobotActionBatch({
  serverUrl,
  batch,
  photoPath,
  cameraPosition,
  steeringAngle,
  distanceCm,
}: CompleteRobotActionBatchOptions): Promise<RobotTaskActionBatchCompleteResponse> {
  const photo = Bun.file(photoPath);

  if (!(await photo.exists())) {
    throw new Error(`Completion photo does not exist: ${photoPath}`);
  }

  const formData = new FormData();
  formData.set("batchId", batch.id);
  formData.set("taskId", batch.taskId);
  if (cameraPosition !== undefined) {
    formData.set("cameraPan", String(cameraPosition.pan));
    formData.set("cameraTilt", String(cameraPosition.tilt));
  }
  if (steeringAngle !== undefined) {
    formData.set("steeringAngle", String(steeringAngle));
  }
  if (distanceCm !== undefined && distanceCm !== null) {
    formData.set("distanceCm", String(distanceCm));
  }
  formData.append("image", photo, basename(photoPath));

  const response = await fetch(actionBatchCompleteUrl({ serverUrl }), {
    method: "POST",
    body: formData,
  });
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: "robot action batch completion",
  });

  if (!response.ok) {
    throw apiError({
      payload,
      rawBody,
      response,
      context: "Action completion",
    });
  }

  return robotTaskActionBatchCompleteResponseSchema.parse(payload);
}

export async function failRobotActionBatch({
  serverUrl,
  batch,
  errorMessage,
}: FailRobotActionBatchOptions): Promise<RobotTaskActionBatchFailResponse> {
  const response = await fetch(actionBatchFailUrl({ serverUrl }), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: batch.id,
      taskId: batch.taskId,
      errorMessage,
    }),
  });
  const rawBody = await response.text();
  const payload = parseJsonPayload({
    rawBody,
    context: "robot action batch failure report",
  });

  if (!response.ok) {
    throw apiError({
      payload,
      rawBody,
      response,
      context: "Action failure report",
    });
  }

  return robotTaskActionBatchFailResponseSchema.parse(payload);
}

function actionBatchPollUrl({
  serverUrl,
}: {
  readonly serverUrl: string;
}): URL {
  return new URL(robotActionBatchPollPath, serverUrl);
}

function actionBatchCompleteUrl({
  serverUrl,
}: {
  readonly serverUrl: string;
}): URL {
  return new URL(robotActionBatchCompletePath, serverUrl);
}

function actionBatchFailUrl({
  serverUrl,
}: {
  readonly serverUrl: string;
}): URL {
  return new URL(robotActionBatchFailPath, serverUrl);
}

function apiError({
  payload,
  rawBody,
  response,
  context,
}: {
  readonly payload: unknown;
  readonly rawBody: string;
  readonly response: Response;
  readonly context: string;
}): Error {
  const error = apiErrorResponseSchema.safeParse(payload);
  const message = error.success ? error.data.message : rawBody;
  return new Error(
    `${context} failed with HTTP ${response.status}: ${message ?? rawBody}`,
  );
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
