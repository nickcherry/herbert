import { collectionPath } from "@herbert/server/persistence/collectionPath";
import { readJsonFile } from "@herbert/server/persistence/readJsonFile";
import { writeJsonFile } from "@herbert/server/persistence/writeJsonFile";
import {
  type TelegramState,
  telegramStateSchema,
} from "@herbert/server/telegram/state/telegramState";

const telegramStatePath = collectionPath({
  collection: "telegram_state",
  filename: "cursor.json",
});

export async function readTelegramState(): Promise<TelegramState> {
  return (
    (await readJsonFile({
      path: telegramStatePath,
      schema: telegramStateSchema,
    })) ?? {}
  );
}

export async function writeTelegramState({
  state,
}: {
  readonly state: TelegramState;
}): Promise<void> {
  await writeJsonFile({
    path: telegramStatePath,
    schema: telegramStateSchema,
    value: state,
  });
}
