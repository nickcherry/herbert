import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { readQueueDocument } from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import { withRobotTaskQueueLock } from "@herbert/server/persistence/operations/robotTaskQueue/queueLock";
import { findLatestActiveSessionIndex } from "@herbert/server/persistence/operations/robotTaskQueue/sessionHelpers";
import type { RobotTaskSession } from "@herbert/shared/robotTaskQueue";

export interface RobotTaskContext {
  readonly session?: RobotTaskSession;
}

export interface ReadRobotTaskContextOptions {
  readonly chatId: string;
  readonly store?: DocumentStore;
}

/**
 * Returns the latest active task session for the chat, if one exists. A new
 * Telegram message that arrives after the previous task is `finished` will
 * see no active session and the OpenAI turn will start a fresh task.
 */
export async function readRobotTaskContext({
  chatId,
  store = defaultDocumentStore(),
}: ReadRobotTaskContextOptions): Promise<RobotTaskContext> {
  return await withRobotTaskQueueLock(async () => {
    const queue = await readQueueDocument({ store });
    const sessionIndex = findLatestActiveSessionIndex({
      sessions: queue.sessions,
      chatId,
    });
    const session =
      sessionIndex === -1 ? undefined : queue.sessions[sessionIndex];

    return { session };
  });
}
