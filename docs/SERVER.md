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

On startup, `server:start` sweeps the robot task queue: every batch still in
`queued` or `claimed` is marked `abandoned`, and every `active` task session is
marked `finished`. If the server was killed mid-batch, we assume the work has
either run to completion or been dropped — either way it should not be
re-executed on restart. The next admin Telegram message starts a fresh task
session.

The robot worker tilts the camera fully up before executing the first action
batch it sees for each task session.

`spokenMessage` from each OpenAI response is synthesized to MP3 by ElevenLabs
and played on the host running `server:start` (via `afplay` on macOS or
`aplay` on Linux). The robot never receives spoken commentary — it only
executes action batches it polls from the queue.

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
the image under `data/robot-batch-photos`, sends the photo to Telegram, and
sends the resulting `batch_complete` turn back to OpenAI to decide whether to
continue.

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
- `ELEVENLABS_API_KEY` is read from env when `spokenMessage` audio is
  synthesized or `audio:test` is run.
- `ELEVENLABS_VOICE_ID` optionally overrides the configured default ElevenLabs
  voice id.
- Server-side persistence uses Bun's built-in SQL client with a local SQLite
  file at `data/herbert.sqlite`.
- Telegram polling and Telegram OpenAI task-loop defaults (including
  `openAIContextMessageMaxAgeMs` and `openAIBatchPhotoLimit`) live in
  `telegramConfig`.
- Generic OpenAI defaults live in `openaiConfig`. Text generation routes
  through `gpt-5.5` by default.
- ElevenLabs defaults (TTS model, voice id, output format, voice settings, and
  request timeout) live in `elevenLabsConfig`.

## Boundary

The server package should own:

- Telegram Bot API calls
- OpenAI API calls for Telegram interpretation
- ElevenLabs API calls for text-to-speech
- SQLite-backed persistence
- administrator authentication
- robot action queue behavior
- server-side audio playback of synthesized commentary

The server package should not talk directly to PiCar-X hardware. Herbert's robot
package owns local hardware execution; the robot never receives spoken
commentary — only the queued action batches.
