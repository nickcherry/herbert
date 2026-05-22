import type { HerbertHistoryResponse } from "@herbert/shared/telegramMessageHistory";

/**
 * Drops Herbert response history entries older than `maxAgeMs`, keeping stale
 * spoken or Telegram text out of the next OpenAI prompt.
 */
export function filterRecentHerbertResponses({
  responses,
  nowMs = Date.now(),
  maxAgeMs,
}: {
  readonly responses: readonly HerbertHistoryResponse[];
  readonly nowMs?: number;
  readonly maxAgeMs: number;
}): readonly HerbertHistoryResponse[] {
  const cutoffMs = nowMs - maxAgeMs;
  return responses.filter((response) => response.createdAtMs >= cutoffMs);
}
