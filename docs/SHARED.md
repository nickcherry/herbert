# Shared Package

`packages/shared` contains Zod schemas and TypeScript types for boundaries
crossed by more than one package.

It defines:

- the JSONL protocol between TypeScript and Python,
- the HTTP contracts shared by `packages/robot` and `packages/server`,
- every persisted document shape stored in the server's SQLite database.

## Rules

- Start with a Zod schema for boundary data.
- Export the TypeScript type from the schema.
- Keep domain behavior out of `packages/shared`.
- Prefer narrow command unions over broad records or stringly typed payloads.
- Any schema/value that gets serialized to the server's SQLite store lives
  here, so the persisted shape is the same artifact every package sees.

## Subpath Exports

- `@herbert/shared/commands` — JSONL command + bridge response shapes.
- `@herbert/shared/robotTasks` — robot action contract used by the queue API
  and the OpenAI structured response.
- `@herbert/shared/robotTaskQueue` — persisted task sessions, batch reports
  (each with optional camera position and photo observation), queued batches,
  and the top-level queue document.
- `@herbert/shared/telegramMessageHistory` — persisted Telegram user message
  history and Herbert Telegram/spoken response history documents.
- `@herbert/shared/telegramState` — persisted Telegram polling cursor.
- `@herbert/shared/serverApi` — HTTP path constants and response shapes used
  by both server and robot packages.
