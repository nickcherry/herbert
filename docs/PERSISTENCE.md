# Persistence

Herbert uses MySQL for server-side persistence. Persistence belongs only in
`packages/server`; the robot package should treat the server as the durable
coordination point.

## Configuration

Set `MYSQL_URL` in the server environment:

```sh
MYSQL_URL="mysql://user:password@localhost:3306/herbert"
```

`MYSQL_URL` is allowed as an environment variable because it contains database
credentials. Normal persistence behavior and table names should stay in code.

The implementation uses Bun's native `Bun.SQL` client. MySQL URLs such as
`mysql://...` and `mysql2://...` are auto-detected by Bun's SQL runtime.

## Schema

The generic document table is created on first persistence access:

```sql
CREATE TABLE IF NOT EXISTS herbert_documents (
  collection VARCHAR(128) NOT NULL,
  document_key VARCHAR(191) NOT NULL,
  document_json JSON NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (collection, document_key)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

This keeps the early persistence model close to the old typed collection model
while moving durability into MySQL. If a subsystem later needs relational
queries, it should get its own purpose-built table and migration.

## Rules

- Every persisted document must parse through a Zod schema on read.
- Every write must validate through the same schema before hitting MySQL.
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

Sources:

- [Bun SQL documentation](https://bun.com/docs/runtime/sql)
