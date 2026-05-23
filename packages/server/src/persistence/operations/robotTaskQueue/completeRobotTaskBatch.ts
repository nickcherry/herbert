import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import {
  type RobotTaskBatchReport,
  robotTaskBatchReportSchema,
  type RobotTaskCameraPosition,
  type RobotTaskQueueBatch,
  type RobotTaskSession,
} from "@herbert/shared/robotTaskQueue";

const MAX_PERSISTED_BATCH_REPORTS = 20;

export interface CompleteRobotTaskBatchOptions {
  readonly batchId: string;
  readonly taskId: string;
  readonly photoPath: string;
  readonly cameraPosition?: RobotTaskCameraPosition;
  readonly steeringAngle?: number;
  readonly distanceCm?: number;
  readonly nowMs?: number;
  readonly store?: DocumentStore;
}

export interface CompleteRobotTaskBatchResult {
  readonly batch: RobotTaskQueueBatch;
  readonly session: RobotTaskSession;
  readonly batchReport: RobotTaskBatchReport;
}

/**
 * Marks a claimed batch as completed, appends a new batch report to the owning
 * session, and returns the completed batch and updated session. Throws if the
 * batch or session can't be found, or if the batch is already marked
 * completed.
 */
export async function completeRobotTaskBatch({
  batchId,
  taskId,
  photoPath,
  cameraPosition,
  steeringAngle,
  distanceCm,
  nowMs = Date.now(),
  store = defaultDocumentStore(),
}: CompleteRobotTaskBatchOptions): Promise<CompleteRobotTaskBatchResult> {
  return await withRobotTaskQueueLock(async () => {
    return await completeRobotTaskBatchUnlocked({
      batchId,
      taskId,
      photoPath,
      cameraPosition,
      steeringAngle,
      distanceCm,
      nowMs,
      store,
    });
  });
}

async function completeRobotTaskBatchUnlocked({
  batchId,
  taskId,
  photoPath,
  cameraPosition,
  steeringAngle,
  distanceCm,
  nowMs,
  store,
}: {
  readonly batchId: string;
  readonly taskId: string;
  readonly photoPath: string;
  readonly cameraPosition: RobotTaskCameraPosition | undefined;
  readonly steeringAngle: number | undefined;
  readonly distanceCm: number | undefined;
  readonly nowMs: number;
  readonly store: DocumentStore;
}): Promise<CompleteRobotTaskBatchResult> {
  const queue = await readQueueDocument({ store });
  const batchIndex = queue.batches.findIndex(
    (batch) => batch.id === batchId && batch.taskId === taskId,
  );
  const batch = batchIndex === -1 ? undefined : queue.batches[batchIndex];

  if (batch === undefined) {
    throw new Error(`Unknown robot action batch: ${batchId}`);
  }

  if (batch.status === "completed") {
    throw new Error(`Robot action batch is already completed: ${batchId}`);
  }

  const sessionIndex = queue.sessions.findIndex(
    (candidate) => candidate.id === taskId,
  );
  const session =
    sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

  if (session === undefined) {
    throw new Error(`Unknown robot task session: ${taskId}`);
  }

  const completedBatch: RobotTaskQueueBatch = {
    ...batch,
    status: "completed",
    completedAtMs: nowMs,
  };
  const batchReport: RobotTaskBatchReport = robotTaskBatchReportSchema.parse({
    batchId,
    completedAtMs: nowMs,
    photoPath,
    ...(cameraPosition === undefined ? {} : { cameraPosition }),
    ...(steeringAngle === undefined ? {} : { steeringAngle }),
    ...(distanceCm === undefined ? {} : { distanceCm }),
    actions: batch.actions,
  });
  const updatedSession: RobotTaskSession = {
    ...session,
    updatedAtMs: nowMs,
    batchReports: [...session.batchReports, batchReport].slice(
      -MAX_PERSISTED_BATCH_REPORTS,
    ),
  };

  await writeQueueDocument({
    store,
    queue: {
      sessions: queue.sessions.map((candidate, index) =>
        index === sessionIndex ? updatedSession : candidate,
      ),
      batches: queue.batches.map((candidate, index) =>
        index === batchIndex ? completedBatch : candidate,
      ),
    },
  });

  return {
    batch: completedBatch,
    session: updatedSession,
    batchReport,
  };
}
