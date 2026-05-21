import { join } from "node:path";

import { persistenceConfig } from "@herbert/server/constants/persistence";

export function collectionPath({
  collection,
  filename,
}: {
  readonly collection: string;
  readonly filename: string;
}): string {
  return join(
    persistenceConfig.runtimeDirectory,
    "collections",
    collection,
    filename,
  );
}
