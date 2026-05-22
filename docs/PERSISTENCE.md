# Persistence

Herbert uses a local SQLite database file for server-side persistence.
Persistence belongs only in `packages/server`; the robot package should treat
the server as the durable coordination point.

## Configuration

The database path is normal config, not an environment variable:

```ts
export const persistenceConfig = {
  sqlitePath: "data/herbert.sqlite",
  observationImageDirectory: "data/robot-observations",
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

This keeps the early persistence model close to the old typed collection model
while keeping durability in a simple local database file. If a subsystem later
needs relational queries, it should get its own purpose-built table and
migration.

## Rules

- Every persisted document must parse through a Zod schema on read.
- Every write must validate through the same schema before hitting SQLite.
- Collection/key names must be narrow and stable.
- Subsystem-specific schemas live near the subsystem that owns the data.
- Broadly shared persisted record types should move to `packages/shared`.
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

Each document stores only the most recent 10 authorized text messages for that
chat id. This keeps prompt context bounded and preserves useful continuity
across server restarts.

## Robot Task Queue

Server-directed robot work is stored in SQLite through the document store:

```text
collection: robot_task_queue
key: default
```

The queue document stores active/finished task sessions plus queued, claimed,
and completed action batches. A task session carries `taskState` and recent
robot observations so subsequent OpenAI turns know the original request and what
has happened since.

Robot completion photos are binary files, not SQLite documents. They are written
under `data/robot-observations` and ignored by git.

Sources:

- [Bun SQL documentation](https://bun.com/docs/runtime/sql)
