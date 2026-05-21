# Telegram

Telegram is the first admin channel for Herbert.

## Required Environment

```sh
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_IDS=8093741032
```

`TELEGRAM_BOT_TOKEN` is the token from BotFather. It is a secret, so it belongs
in the environment. `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated list of chat
ids allowed to administer Herbert over Telegram.

Example with multiple admins:

```sh
TELEGRAM_ADMIN_CHAT_IDS=8093741032,123456789
```

## Config

Polling defaults and message text live in
`packages/server/src/constants/telegram.ts`.

Do not add env vars for polling interval or batch size. Those are normal runtime
config, not deployment-local identity.

Current polling cadence:

- Cold: poll every 10 seconds.
- Active: poll every 2 seconds after any message has arrived in the last 30
  seconds.
- The three cadence values live in `telegramConfig`.

## Getting The Chat Id

1. Create a bot with BotFather and set `TELEGRAM_BOT_TOKEN`.
2. Send a message to the bot from the admin account or group.
3. Run `bun herbert telegram:updates`.
4. Find the `chat=...` value in the output.
5. Put that value in `TELEGRAM_ADMIN_CHAT_IDS`.

Example output:

```text
update=123456 chat=987654321 text="hi"
```

In that case, set:

```sh
TELEGRAM_ADMIN_CHAT_IDS=987654321
```

## Setup Check

1. Set `TELEGRAM_ADMIN_CHAT_IDS`.
2. Run `bun herbert telegram:test` to verify outbound messaging.
3. Run `bun herbert telegram:monitor` and send `/ping`.

## Safety

Inbound Telegram messages are not trusted just because they came through the bot.
The server must check the chat id against `TELEGRAM_ADMIN_CHAT_IDS` before
interpreting a message as an admin command.

## Cursor State

Telegram cursor state is stored in
`runtime/collections/telegram_state/cursor.json`.

The stored cursor is Telegram's next `update_id` offset, not a message timestamp.
This keeps restart behavior efficient even after hundreds or thousands of
messages.
