import type { HerbertHistoryResponse } from "@herbert/shared/telegramMessageHistory";

/**
 * Drops Herbert response history entries older than `maxAgeMs`, keeping stale
 * spoken or Telegram text out of the next OpenAI prompt.
 */
export function filterRecentHerbertResponses({
  responses,
  nowMs = Date.now(),
  maxAgeMs,
  sinceMs,
}: {
  readonly responses: readonly HerbertHistoryResponse[];
  readonly nowMs?: number;
  readonly maxAgeMs: number;
  readonly sinceMs?: number;
}): readonly HerbertHistoryResponse[] {
  const cutoffMs = nowMs - maxAgeMs;
  const minimumCreatedAtMs =
    sinceMs === undefined ? cutoffMs : Math.max(cutoffMs, sinceMs);
  return responses.filter(
    (response) => response.createdAtMs >= minimumCreatedAtMs,
  );
}
