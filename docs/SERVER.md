# Server Package

`packages/server` is Herbert's lightweight coordination process. It can run on
Nick's laptop while Herbert is manually driven from the Raspberry Pi.

The server currently owns:

- `GET /ping` for smoke checks.
- `POST /robot/photos` for relaying manually captured robot photos to Telegram.
- Generic Telegram Bot API helpers.
- Generic OpenAI helpers for future structured calls.

It does not own a robot action queue or an autonomous Telegram/OpenAI task loop.

## CLI

```sh
bun herbert server:start
bun herbert telegram:updates
bun herbert telegram:test
```

`server:start` starts the Bun HTTP server. It does not require OpenAI. Photo
relay requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_IDS`; without those
env vars the server still starts, but `POST /robot/photos` returns a
configuration error.

The default robot upload target is Nick's laptop at
`http://Nicks-MacBook-Pro.local:8787`.

`telegram:updates` reads one batch of updates and prints chat ids. Use this to
discover the chat id after sending a message to the bot. This command only needs
`TELEGRAM_BOT_TOKEN`.

`telegram:test` sends one message to the first chat id in
`TELEGRAM_ADMIN_CHAT_IDS`.

When `server:start` exits from `SIGINT` or `SIGTERM`, it stops the HTTP server.

## Routes

`GET /ping` returns:

```json
{
  "ok": true,
  "service": "herbert-server"
}
```

`POST /robot/photos` accepts a multipart image attachment in the `image` field,
plus an optional `sourcePath` field for request metadata. The server sends the
image to every chat id in `TELEGRAM_ADMIN_CHAT_IDS` through Telegram
`sendPhoto` without adding a caption.

## Config

Secrets and deployment-local identities live in env. Runtime tuning config lives
in typed constants.

- `TELEGRAM_BOT_TOKEN` is read from env.
- `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated env list of authorized admin
  chat ids.
- `OPENAI_API_KEY` is read from env only by generic OpenAI callers.
- Server host and port live in `serverConfig`.
- Telegram helper defaults live in `telegramConfig`.
- Generic OpenAI defaults live in `openaiConfig`.

## Boundary

The server package should own HTTP routes and external service wrappers. It
should not talk directly to PiCar-X hardware. Herbert's robot package owns local
hardware execution.
