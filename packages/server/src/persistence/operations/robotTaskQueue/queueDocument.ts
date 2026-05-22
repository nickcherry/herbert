import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import {
  type RobotTaskQueueDocument,
  robotTaskQueueDocumentSchema,
} from "@herbert/shared/robotTaskQueue";

const QUEUE_DOCUMENT_COLLECTION = "robot_task_queue";
const QUEUE_DOCUMENT_KEY = "default";

function queueDocumentIdentity(): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: QUEUE_DOCUMENT_COLLECTION,
    key: QUEUE_DOCUMENT_KEY,
  };
}

/**
 * Reads the canonical queue document, parsed through the shared schema.
 * Returns an empty queue if the document has never been written.
 */
export async function readQueueDocument({
  store,
}: {
  readonly store: DocumentStore;
}): Promise<RobotTaskQueueDocument> {
  const queue = await store.read({
    ...queueDocumentIdentity(),
    schema: robotTaskQueueDocumentSchema,
  });

  return queue ?? { sessions: [], batches: [] };
}

/**
 * Writes the canonical queue document. Callers must hold the queue lock.
 */
export async function writeQueueDocument({
  store,
  queue,
}: {
  readonly store: DocumentStore;
  readonly queue: RobotTaskQueueDocument;
}): Promise<void> {
  await store.write({
    ...queueDocumentIdentity(),
    schema: robotTaskQueueDocumentSchema,
    value: queue,
  });
}
