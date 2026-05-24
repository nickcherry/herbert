# Telegram

Telegram is Herbert's admin notification channel. The repo keeps generic Bot
API helpers for sending messages, sending photos, reading updates, extracting
messages, and checking authorized chat ids.

There is no current Telegram-to-OpenAI robot task loop.

## Required Environment

```sh
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_IDS=8093741032
```

`TELEGRAM_BOT_TOKEN` is the token from BotFather. It is a secret, so it belongs
in the environment. `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated list of chat
ids allowed to receive Herbert admin messages.

Example with multiple admins:

```sh
TELEGRAM_ADMIN_CHAT_IDS=8093741032,123456789
```

## Config

Telegram helper defaults live in
`packages/server/src/constants/telegram.ts`.

Do not add env vars for polling timeout, batch size, or default test text.
Those are normal runtime config, not deployment-local identity.

## Getting The Chat Id

1. Create a bot with BotFather and set `TELEGRAM_BOT_TOKEN`.
2. Send a message to the bot from the admin account or group.
3. Run `bun herbert telegram:updates`.
4. Find the `chat=...` value in the output.
5. Put that value in `TELEGRAM_ADMIN_CHAT_IDS`.

Example output:

```text
update id=123456 chat=987654321 text="hi"
```

In that case, set:

```sh
TELEGRAM_ADMIN_CHAT_IDS=987654321
```

## Smoke Check

1. Set `TELEGRAM_BOT_TOKEN`.
2. Run `bun herbert telegram:updates` after messaging the bot.
3. Set `TELEGRAM_ADMIN_CHAT_IDS`.
4. Run `bun herbert telegram:test`.

## Photo Relay

Keyboard control can upload manually captured robot photos to the server:

```text
robot keyboard `p`
  -> packages/robot uploads POST /robot/photos
  -> packages/server sends Telegram sendPhoto to admin chat ids
```

The server photo route requires `TELEGRAM_BOT_TOKEN` and at least one
`TELEGRAM_ADMIN_CHAT_IDS` value. The robot can disable upload with
`--no-photo-upload`.

## Safety

Inbound Telegram messages are not trusted just because they came through the bot.
Any future inbound command surface must check the chat id against
`TELEGRAM_ADMIN_CHAT_IDS` before treating a message as an admin command.
