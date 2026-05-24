# Server Package

`packages/server` is Herbert's lightweight coordination process. It is intended
to run on the Mac mini while Herbert is manually driven from a browser.

The server currently owns:

- `GET /ping` for smoke checks.
- `POST /robot/photos` for relaying manually captured robot photos to Telegram.
- `POST /robot/video/frames` for ingesting robot video frames.
- `/`, `/video.mjpeg`, `/video/latest.jpg`, and `/video/status` for the hosted
  live video app.
- `POST /control`, `GET /robot/control/next`, and
  `GET /robot/control/status` for browser-to-robot manual control.
- Generic Telegram Bot API helpers.
- Generic OpenAI helpers for future structured calls.

It does not own an autonomous Telegram/OpenAI task loop. The manual control
queue is transient in-memory handoff state for the browser UI and the robot
video process.

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

The default robot upload target is the Mac mini at `http://mac-mini.local:8787`.

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

`POST /robot/video/frames` accepts a raw JPEG body with
`Content-Type: image/jpeg`. The robot includes optional
`x-herbert-captured-at-ms`, `x-herbert-frame-width`, and
`x-herbert-frame-height` headers. The server stores only the latest frame in
memory and returns the assigned frame id.

`GET /video.mjpeg` streams the latest and future frames as
`multipart/x-mixed-replace`. `GET /video/latest.jpg` returns the latest frame as
a plain JPEG, and `GET /video/status` returns connection and freshness metadata
used by the web app.

`GET /` serves the single page live video app. Browser clients connect only to
the Mac mini server; the robot initiates the outbound frame uploads and polls
for operator control commands.

`POST /control` accepts JSON control commands from the browser:

```json
{ "type": "drive", "direction": "forward", "speed": 45, "durationMs": 300 }
```

Other accepted command shapes are:

```json
{ "type": "drive", "direction": "backward", "speed": 45, "durationMs": 300 }
{ "type": "steer", "delta": -8 }
{ "type": "camera", "axis": "tilt", "delta": 5 }
{ "type": "stop" }
```

The server validates the command and queues it in memory. `stop` clears older
queued movement first so stale browser taps do not execute after an emergency
stop.

`GET /robot/control/next` is polled by `robot:video-stream` and returns the next
queued command or `null`. `GET /robot/control/status` reports queue depth and is
used by the web UI.

## Config

Secrets and deployment-local identities live in env. Runtime tuning config lives
in typed constants.

- `TELEGRAM_BOT_TOKEN` is read from env.
- `TELEGRAM_ADMIN_CHAT_IDS` is a comma-separated env list of authorized admin
  chat ids.
- `OPENAI_API_KEY` is read from env only by generic OpenAI callers.
- Server host, port, and HTTP idle timeout live in `serverConfig`.
- Telegram helper defaults live in `telegramConfig`.
- Generic OpenAI defaults live in `openaiConfig`.

## Boundary

The server package should own HTTP routes and external service wrappers. It
should not talk directly to PiCar-X hardware. Herbert's robot package owns local
hardware execution.
