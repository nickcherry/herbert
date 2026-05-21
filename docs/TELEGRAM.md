# Telegram

Telegram is the first admin channel for Herbert.

## Required Environment

```sh
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_IDS=8093741032
OPENAI_API_KEY=...
```

`TELEGRAM_BOT_TOKEN` is the token from BotFather. It is a secret, so it belongs
in the environment. `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated list of chat
ids allowed to administer Herbert over Telegram. `OPENAI_API_KEY` is required
when running `telegram:monitor` or `server:start` with Telegram polling enabled.

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
- OpenAI Telegram context keeps the most recent 10 authorized text messages per
  admin chat id.

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
3. Set `OPENAI_API_KEY`.
4. Run `bun herbert telegram:monitor` and send `/ping`.

## Safety

Inbound Telegram messages are not trusted just because they came through the bot.
The server must check the chat id against `TELEGRAM_ADMIN_CHAT_IDS` before
interpreting a message as an admin command.

## OpenAI Replies

Every authorized Telegram text message is sent to OpenAI with that message plus
up to the 10 most recent authorized text messages from the same admin chat id.
OpenAI must return:

```ts
{
  message: string;
  actions: Action[];
}
```

`message` is sent back to Telegram as plain text. `actions` are parsed and
logged, but they are not executed yet because the server-to-robot command
transport is not implemented.

The OpenAI-facing action contract is deliberately narrower than the low-level
Python bridge:

- `drive`: `direction` is `forward` or `backward`, `speed` is `1..50`, and
  `durationMs` is `100..1000`.
- `drive_arc`: same drive parameters plus `angle` from `-30..30`; negative is
  left and positive is right.
- `set_steering`: `angle` from `-30..30`.
- `look`: `panDelta` and `tiltDelta` from `-10..10`.
- `take_photo`
- `say`: `text` must pass Herbert's speech text validation before execution is
  allowed.
- `stop`

Steering is capped at `-30..30` because the PiCar-X v2.0 SDK clamps direction
servo input to that range. Camera deltas are narrower than the bridge's absolute
camera range so one model response cannot swing the head from one extreme to the
other.

## Cursor State

Telegram cursor state is stored in SQLite through the server document store:

```text
collection: telegram_state
key: cursor
```

The stored cursor is Telegram's next `update_id` offset, not a message timestamp.
This keeps restart behavior efficient even after hundreds or thousands of
messages.

## Message History State

Authorized Telegram text history is stored in SQLite through the server document
store:

```text
collection: telegram_message_history
key: <admin chat id>
```

Each document stores the most recent 10 authorized text messages for that chat
id. The current message is excluded when reading history for an OpenAI request
and appended after the OpenAI response is produced.
