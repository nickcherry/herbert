import type {
  TelegramMessage,
  TelegramUpdate,
} from "@herbert/server/telegram/schemas";

export function extractTelegramMessages({
  updates,
}: {
  readonly updates: readonly TelegramUpdate[];
}): readonly TelegramMessage[] {
  return updates.flatMap((update) => {
    if (update.message !== undefined) {
      return [update.message];
    }

    if (update.edited_message !== undefined) {
      return [update.edited_message];
    }

    return [];
  });
}
