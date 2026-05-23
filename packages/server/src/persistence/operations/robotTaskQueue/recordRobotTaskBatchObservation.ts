import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  readQueueDocument,
  writeQueueDocument,
} from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import type {
  RobotTaskBatchPhotoObservation,
  RobotTaskSession,
} from "@herbert/shared/robotTaskQueue";

export interface RecordRobotTaskBatchObservationOptions {
  readonly taskId: string;
  readonly batchId: string;
  readonly observation: RobotTaskBatchPhotoObservation;
  readonly store?: DocumentStore;
}

export interface RecordRobotTaskBatchObservationResult {
  readonly session: RobotTaskSession;
}

export async function recordRobotTaskBatchObservation({
  taskId,
  batchId,
  observation,
  store = defaultDocumentStore(),
}: RecordRobotTaskBatchObservationOptions): Promise<RecordRobotTaskBatchObservationResult> {
  return await withRobotTaskQueueLock(async () => {
    const queue = await readQueueDocument({ store });
    const sessionIndex = queue.sessions.findIndex(
      (candidate) => candidate.id === taskId,
    );
    const session =
      sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

    if (session === undefined) {
      throw new Error(`Unknown robot task session: ${taskId}`);
    }

    const reportIndex = session.batchReports.findIndex(
      (candidate) => candidate.batchId === batchId,
    );

    if (reportIndex === -1) {
      throw new Error(`Unknown robot task batch report: ${batchId}`);
    }

    const updatedSession: RobotTaskSession = {
      ...session,
      batchReports: session.batchReports.map((candidate, index) =>
        index === reportIndex
          ? { ...candidate, photoObservation: observation }
          : candidate,
      ),
    };

    await writeQueueDocument({
      store,
      queue: {
        ...queue,
        sessions: queue.sessions.map((candidate, index) =>
          index === sessionIndex ? updatedSession : candidate,
        ),
      },
    });

    return { session: updatedSession };
  });
}
