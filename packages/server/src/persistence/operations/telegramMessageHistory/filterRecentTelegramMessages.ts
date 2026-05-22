import type { TelegramHistoryMessage } from "@herbert/shared/telegramMessageHistory";

/**
 * Drops persisted history messages older than `maxAgeMs`. Pure function
 * applied at every call site that builds an OpenAI prompt so stale
 * conversation never leaks back into the model context.
 */
export function filterRecentTelegramMessages({
  messages,
  nowMs = Date.now(),
  maxAgeMs,
}: {
  readonly messages: readonly TelegramHistoryMessage[];
  readonly nowMs?: number;
  readonly maxAgeMs: number;
}): readonly TelegramHistoryMessage[] {
  const cutoffSeconds = Math.floor((nowMs - maxAgeMs) / 1_000);
  return messages.filter((message) => message.date >= cutoffSeconds);
}
