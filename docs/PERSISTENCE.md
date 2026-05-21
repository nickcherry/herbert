# Persistence

Herbert needs lightweight persistence, but not a database server yet.

Recommendation: start with repo-local filesystem persistence under the
gitignored `runtime/` directory, using typed collections. A collection is a
directory of records or state files owned by one subsystem.

Why:

- The first server is a single Mac mini process.
- Early data is operational: Telegram messages, command requests, robot status,
  photo metadata, and audit events.
- JSON and JSONL files are easy to inspect, back up, replay, and migrate.
- It keeps the first command broker simple.

Do not start with MySQL unless we need multi-process writes, relational queries,
or remote clients writing directly to storage. When that pressure appears, the
event log can be migrated into a database with a clear schema because every
record will already have a typed event shape.

Current layout:

```text
runtime/
  collections/
    telegram_state/
      cursor.json
```

Likely future layout:

```text
runtime/
  collections/
    telegram_state/
      cursor.json
    telegram_events/
      events.jsonl
    command_events/
      events.jsonl
    robot_state/
      latest.json
  photos/
    ...
```

## Rules

- Every filesystem read must parse through a Zod schema before application code
  uses the value.
- Every filesystem write must validate through the same schema before bytes hit
  disk.
- Collection helpers live under `packages/server/src/persistence`.
- Subsystem-specific schemas live near the subsystem that owns the data.
- Broadly shared persisted record types should move to `packages/shared`.
- Prefer small JSON state files for cursors and snapshots.
- Prefer append-only JSONL for event streams and audit trails.

## Telegram Cursor

Telegram polling stores cursor state in:

```text
runtime/collections/telegram_state/cursor.json
```

The cursor stores `nextUpdateOffset`, derived from Telegram's monotonic
`update_id`. This is better than message timestamp for resume behavior because
the Telegram `getUpdates` API uses `offset` to skip already processed updates.
On restart, Herbert can resume at the next update without scanning old messages.
