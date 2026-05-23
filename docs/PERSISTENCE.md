# Persistence

Herbert uses local SQLite for every persisted document on the server. The
robot package treats the server as the durable coordination point.

## Configuration

The database path is normal config, not an environment variable:

```ts
export const persistenceConfig = {
  sqlitePath: "data/herbert.sqlite",
  batchPhotoDirectory: "data/robot-batch-photos",
} as const;
```

The implementation creates the client with Bun's native SQL runtime using
`Bun.SQL({ adapter: "sqlite", filename })`. The `data/` directory is created on
startup if needed, and generated SQLite files are gitignored.

## Schema

The generic document table is created on first persistence access:

```sql
CREATE TABLE IF NOT EXISTS herbert_documents (
  collection TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, document_key)
);
```

This keeps durability simple while preserving collection-style documents. If a
subsystem later needs relational queries, it should get its own table and
migration — the OpenAI call log below is the first such opt-out.

## Type Safety

Reads and writes are typed end-to-end:

- `DocumentStore.read<Schema>` is parameterized by the caller's Zod schema and
  returns `z.infer<Schema> | undefined`.
- `DocumentStore.write<Schema>` takes a `value: z.input<Schema>` so writers
  can't pass arbitrary shapes through TypeScript.
- `SqliteDocumentStore` runs `schema.parse(...)` on the way out (read) and on
  the way in (write) — defense in depth even when the static types are right.
- `querySql({ rowSchema })` parses raw SQL rows before returning them, so no
  result row escapes the persistence layer untyped.
- `SqlValue = string | number | boolean | null | Date | Uint8Array`. The
  template-literal SQL signature refuses arbitrary objects, so callers can't
  smuggle untyped values into a query.

Every persisted shape lives in `@herbert/shared/*` so the schema and the
inferred TypeScript type are the same artifact across the codebase.

## Operations

Persistence access goes through one named operation per file under:

```text
packages/server/src/persistence/operations/<domain>/<operation>.ts
```

Each operation file exports a single async function that returns typed data.
Tiny domain helpers (Rails-style scopes / fat-model helpers — e.g. session
finders, public-shape converters, the queue mutex) live alongside the queries
that use them. Moderately-involved domain logic (orchestration of multiple
operations + side effects like Telegram or audio) stays outside the
persistence layer.

Public ops by domain today:

- `operations/robotTaskQueue/`
  - `readRobotTaskContext`
  - `recordRobotTaskResponse`
  - `claimNextRobotTaskBatch`
  - `completeRobotTaskBatch`
  - `abandonPendingRobotTaskWork`
- `operations/telegramMessageHistory/`
  - `readTelegramMessageHistory`
  - `appendTelegramMessageHistory`
  - `appendTelegramMessageHistoryBatch`
  - `filterRecentTelegramMessages` (pure scope-style helper)
  - `telegramHistoryMessageFromTelegram` (constructor from raw API shape)
- `operations/herbertResponseHistory/`
  - `readHerbertResponseHistory`
  - `appendHerbertResponseHistory`
  - `filterRecentHerbertResponses` (pure scope-style helper)
- `operations/telegramState/`
  - `readTelegramState`
  - `writeTelegramState`

The OpenAI call log lives in its own subdirectory (`openaiCallLog/`) and
talks SQL directly because it owns its own table — see
[Robot Task Queue](#robot-task-queue) for that pattern, and the
[OpenAI Call Log](#openai-call-log) section below for the specifics.

## Rules

- Every persisted document parses through a Zod schema on read and write.
- Persisted schemas + their persisted sub-types live in `@herbert/shared/*`
  (`robotTaskQueue`, `telegramMessageHistory`, `telegramState`).
- Every result-bearing SQL query uses `querySql` with a Zod row schema.
  Schema/mutation SQL that does not consume rows uses `executeSql`.
- Collection/key names are narrow and stable.
- Callers reach the database **only** through a named operation under
  `@herbert/server/persistence/operations/<domain>`. ESLint blocks direct
  imports of `defaultDocumentStore`, `SqliteDocumentStore`, `querySql`, and
  direct `store.read` / `store.write` calls outside the persistence folder.
- The default singleton store is constructed lazily by `defaultDocumentStore`;
  tests pass an in-memory `DocumentStore` impl to bypass SQLite.
- Do not add filesystem persistence under `runtime/`.

## Telegram Cursor

Telegram polling stores cursor state as:

```text
collection: telegram_state
key: cursor
```

The cursor stores `nextUpdateOffset`, derived from Telegram's monotonic
`update_id`. This is better than message timestamp for resume behavior because
the Telegram `getUpdates` API uses `offset` to skip already processed updates.
On restart, Herbert can resume at the next update without scanning old messages.

## Telegram Message History

Telegram OpenAI context stores authorized text history as:

```text
collection: telegram_message_history
key: <admin chat id>
```

Each document stores only the most recent 20 authorized text messages for that
chat id. This keeps prompt context bounded and preserves useful continuity
across server restarts. Before history goes into an OpenAI prompt it is run
through `filterRecentTelegramMessages` with
`telegramConfig.openAIContextMessageMaxAgeMs` to drop stale entries.

## Robot Task Queue

Server-directed robot work is stored in SQLite through the document store:

```text
collection: robot_task_queue
key: default
```

The queue document stores active/finished task sessions plus queued, claimed,
completed, and abandoned action batches. A task session carries `taskState`
and recent batch report entries so subsequent OpenAI turns know the original
request and what has happened since. Each batch report signals that a batch
finished and includes the completed actions, the completion photo path, and
the robot's absolute camera pan/tilt and front steering angle when the worker
reported them. Batch reports can also include a stored `photoObservation`: a
compact structured description of the batch completion photo used as text
history once that photo is no longer the latest/current attached image. The
robot worker treats the first batch it sees for a task session as the session
start, centers the steering, and tilts the camera fully up before executing
that batch.

`server:start` runs `abandonPendingRobotTaskWork` on boot. Any batch still in
`queued` or `claimed` from a previous run is marked `abandoned`, and any
`active` session is marked `finished`. The server cannot tell whether the
work was completed before shutdown or simply never ran, so it treats it as
done either way — the queue will never replay a stale batch.

Queue mutations are serialized inside the server process via the
`withRobotTaskQueueLock` helper because the first implementation stores the
queue as one typed document.

Robot completion photos are binary files, not SQLite documents. They are
written under `data/robot-batch-photos` and ignored by git. Synthesized speech
MP3s are scratch files under the OS tempdir and are not persisted at all.
The spoken text itself is persisted in `herbert_response_history` together with
Herbert's recent Telegram reply text so later OpenAI turns know what Herbert
already said out loud or sent to the admin chat.

## OpenAI Call Log

Every `promptOpenAI` call is recorded to a dedicated relational table so it
is searchable by `type`, chat, task, and time. The table is created lazily on
first append:

```sql
CREATE TABLE IF NOT EXISTS openai_call_log (
  id TEXT PRIMARY KEY,
  created_at_ms INTEGER NOT NULL,
  type TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  chat_id TEXT,
  task_id TEXT,
  instructions TEXT,
  prompt TEXT NOT NULL,
  image_paths_json TEXT NOT NULL,
  response_json TEXT,
  error_message TEXT,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER
);
```

Indexes cover `(created_at_ms)`, `(type, created_at_ms)`, and
`(chat_id, created_at_ms)`. Reads go through `SqliteOpenaiCallLog#list` which
supports filters `type`, `chatId`, `taskId`, `sinceMs`, `limit` (cap 500).
Append is best-effort: a write failure logs to stderr but does not surface to
the caller, so logging never blocks an OpenAI response.

`image_paths_json` stores the on-disk paths Herbert sent to the API, not the
image bytes themselves; resolve them against the filesystem to reconstruct
what the model actually saw.

Sources:

- [Bun SQL documentation](https://bun.com/docs/runtime/sql)
