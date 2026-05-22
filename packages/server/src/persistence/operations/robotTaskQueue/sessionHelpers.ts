import type { RobotTaskSession } from "@herbert/shared/robotTaskQueue";

/**
 * Returns the index of the latest active session for the given chat id, or
 * `-1` if no active session exists. "Active" excludes finished sessions —
 * a chat that just ended a task needs to start a new session on the next
 * Telegram message.
 */
export function findLatestActiveSessionIndex({
  sessions,
  chatId,
}: {
  readonly sessions: readonly RobotTaskSession[];
  readonly chatId: string;
}): number {
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const candidate = sessions[index];

    if (candidate?.chatId === chatId && candidate.status === "active") {
      return index;
    }
  }

  return -1;
}

/**
 * Compact random id segment used when building task / batch ids. Short enough
 * to keep ids readable, long enough to avoid same-millisecond collisions.
 */
export function randomIdSegment(): string {
  return Math.random().toString(36).slice(2, 10);
}
