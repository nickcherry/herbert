# Server Package

`packages/server` contains the process intended to run on the Mac mini.

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
tests and starts Telegram polling by default. Use `--no-telegram` only for local
HTTP-only checks.

`POST /robot/photos` accepts a multipart image attachment in the `image` field,
plus an optional `sourcePath` field. The server sends the image to every chat id
in `TELEGRAM_ADMIN_CHAT_IDS` through Telegram `sendPhoto`.

`telegram:updates` reads one batch of updates and prints chat ids. Use this to
discover the chat id after sending a message to the bot. This command only needs
`TELEGRAM_BOT_TOKEN`.

`telegram:test` sends one message to the first chat id in
`TELEGRAM_ADMIN_CHAT_IDS`.

`telegram:monitor` long-polls Telegram, ignores non-admin chats, logs
authorized text messages, and replies to `/ping`. It does not yet enqueue robot
commands.

When `server:start` exits from `SIGINT` or `SIGTERM`, it aborts Telegram polling
and then stops the HTTP server.

## Config

Secrets and deployment-local identities live in env. Runtime tuning config lives
in typed constants.

- `TELEGRAM_BOT_TOKEN` is read from env.
- `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated env list of authorized admin
  chat ids.
- `MYSQL_URL` is read from env for server-side persistence.
- Telegram polling defaults also live in `telegramConfig`.

## Boundary

The server package should own:

- Telegram Bot API calls
- OpenAI API calls
- MySQL-backed persistence
- administrator authentication
- future command broker behavior
- future server-side command persistence

The server package should not talk directly to PiCar-X hardware. Herbert's robot
package owns local hardware execution.
