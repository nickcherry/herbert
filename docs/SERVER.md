# Server Package

`packages/server` contains the process intended to run on the Mac mini. For the
current apartment-driving setup, it can also run on Nick's laptop.

Today it owns Telegram administration primitives. Later it should become the
coordination point that Herbert's robot process polls or connects to over a
socket.

It also owns generic OpenAI SDK integration for server-side interpretation,
image understanding, and future command planning.

## CLI

```sh
bun herbert server:start
bun herbert telegram:updates
bun herbert telegram:test
bun herbert telegram:monitor
```

`server:start` starts the Bun HTTP server. It exposes `GET /ping` for smoke
tests and starts Telegram polling by default. Because Telegram polling now sends
authorized text messages to OpenAI, `OPENAI_API_KEY` is required unless
`--no-telegram` is used. Use `--no-telegram` only for local HTTP-only checks.
The robot package currently uploads photos to the laptop default
`http://Nicks-MacBook-Pro.local:8787`.

`POST /robot/photos` accepts a multipart image attachment in the `image` field,
plus an optional `sourcePath` field. The server sends the image to every chat id
in `TELEGRAM_ADMIN_CHAT_IDS` through Telegram `sendPhoto`.

`telegram:updates` reads one batch of updates and prints chat ids. Use this to
discover the chat id after sending a message to the bot. This command only needs
`TELEGRAM_BOT_TOKEN`.

`telegram:test` sends one message to the first chat id in
`TELEGRAM_ADMIN_CHAT_IDS`.

`telegram:monitor` long-polls Telegram, ignores non-admin chats, logs
authorized text messages, sends each authorized text message plus recent context
to OpenAI, and replies with the structured OpenAI response's `message`. Planned
robot `actions` are parsed and logged, but they are not executed yet because the
server-to-robot command transport is not implemented.

When `server:start` exits from `SIGINT` or `SIGTERM`, it aborts Telegram polling
and then stops the HTTP server.

## Config

Secrets and deployment-local identities live in env. Runtime tuning config lives
in typed constants.

- `TELEGRAM_BOT_TOKEN` is read from env.
- `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated env list of authorized admin
  chat ids.
- `OPENAI_API_KEY` is read from env when authorized Telegram messages are sent
  through the OpenAI response helper.
- Server-side persistence uses Bun's built-in SQL client with a local SQLite
  file at `data/herbert.sqlite`.
- Telegram polling defaults also live in `telegramConfig`.

## Boundary

The server package should own:

- Telegram Bot API calls
- OpenAI API calls
- SQLite-backed persistence
- administrator authentication
- future command broker behavior
- future server-side command persistence

The server package should not talk directly to PiCar-X hardware. Herbert's robot
package owns local hardware execution.
