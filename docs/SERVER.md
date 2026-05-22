# Server Package

`packages/server` is Herbert's coordination process. It can run on the Mac mini
or Nick's laptop while the setup is still local.

The server owns Telegram administration, OpenAI interpretation, SQLite-backed
task state, and the HTTP routes that Herbert's robot process polls.

## CLI

```sh
bun herbert server:start
bun herbert telegram:updates
bun herbert telegram:test
bun herbert telegram:monitor
```

`server:start` starts the Bun HTTP server and Telegram polling. It requires
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_IDS`, and `OPENAI_API_KEY` unless
`--no-telegram` is used for HTTP-only checks. The default robot upload target is
Nick's laptop at `http://Nicks-MacBook-Pro.local:8787`.

`GET /ping` returns a small JSON response for smoke tests.

`POST /robot/photos` accepts a multipart image attachment in the `image` field,
plus an optional `sourcePath` field for request metadata. The server sends the
image to every chat id in `TELEGRAM_ADMIN_CHAT_IDS` through Telegram
`sendPhoto` without adding a caption.

`telegram:updates` reads one batch of updates and prints chat ids. Use this to
discover the chat id after sending a message to the bot. This command only needs
`TELEGRAM_BOT_TOKEN`.

`telegram:test` sends one message to the first chat id in
`TELEGRAM_ADMIN_CHAT_IDS`.

`telegram:monitor` runs the Telegram polling loop without starting the HTTP
server. It is useful for testing the Telegram/OpenAI path in isolation.

`GET /robot/action-batches/next` lets Herbert claim the next queued action
batch. `POST /robot/action-batches/complete` accepts `batchId`, `taskId`, and an
`image` attachment from the robot after it executes a batch. The server stores
the image under `data/robot-observations`, sends the photo to Telegram, and
sends the turn observation back to OpenAI to decide whether to continue.

When `server:start` exits from `SIGINT` or `SIGTERM`, it stops Telegram polling
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
- robot action queue behavior

The server package should not talk directly to PiCar-X hardware. Herbert's robot
package owns local hardware execution.
