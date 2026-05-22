# Telegram

Telegram is Herbert's admin channel. The server polls Telegram, sends authorized
messages to OpenAI, queues robot actions when needed, and sends replies or photos
back to Telegram.

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

## Smoke Check

1. Set `TELEGRAM_ADMIN_CHAT_IDS`.
2. Run `bun herbert telegram:test` to verify outbound messaging.
3. Set `OPENAI_API_KEY`.
4. Run `bun herbert telegram:monitor` and send `/ping`.

## Safety

Inbound Telegram messages are not trusted just because they came through the bot.
The server must check the chat id against `TELEGRAM_ADMIN_CHAT_IDS` before
interpreting a message as an admin command.

## OpenAI Task Loop

Every polling response is grouped by admin chat id. If Telegram returns multiple
unseen messages for the same admin chat, the server sends them together in one
OpenAI request with recent same-chat context. OpenAI returns:

```ts
{
  telegramMessage: string | null;
  spokenMessage: string | null;
  taskState: string;
  isFinished: boolean;
  actions: Action[];
}
```

`telegramMessage` is sent back to Telegram when present. `spokenMessage` is
logged for the future physical voice path. `taskState` is persisted for
multi-turn robot work. `isFinished` closes the active task for that chat and
must be paired with an empty action list.

When actions are returned, the server queues them as a robot action batch in
SQLite. Herbert's robot process polls the queue, executes the batch, captures an
end-of-batch photo, and reports completion back to the server. That photo and
the completed actions become the next OpenAI turn's robot commentary entry.

User message context is formatted as XML:

```xml
<turn_context>
  <trigger>telegram_messages</trigger>
  <new_message_count>1</new_message_count>
  <robot_commentary_count>0</robot_commentary_count>
  <latest_image_attached>0</latest_image_attached>
</turn_context>
```

```xml
<user_messages>
  <message>
    <sender>Nick</sender>
    <text>hi</text>
    <timestamp>2026-05-21 17:39:56</timestamp>
    <is_new>1</is_new>
  </message>
</user_messages>
```

Messages are oldest first. Prior context has `is_new` set to `0`; messages from
the current polling response have `is_new` set to `1`.

Robot commentary entries are also formatted as XML. When the turn trigger is
`robot_commentary`, there are usually no new Telegram messages; OpenAI should
continue from `taskState`, the commentary XML, and the attached photo. The
photo from the latest completed robot batch is attached as an image input;
earlier commentary entries list a photo path but the photos themselves are not
attached.

The OpenAI-facing action contract is deliberately narrower than the low-level
Python bridge:

- `drive`: `direction` is `forward` or `backward`, `speed` is `1..50`, and
  `durationMs` is `100..1000`. This is straight driving; the robot worker centers
  steering first.
- `drive_arc`: same drive parameters plus `angle` from `-30..30`; negative is
  left and positive is right.
- `set_steering`: `angle` from `-30..30`; turns the front wheels in place without
  moving the robot.
- `look`: `panDelta` and `tiltDelta` from `-10..10`.
- `take_photo`
- `stop`: emergency or cancel semantic; keep it available even though normal
  drive actions are short finite pulses.

Steering is capped at `-30..30` because the PiCar-X v2.0 SDK clamps direction
servo input to that range. Camera deltas are narrower than the bridge's absolute
camera range so one model response cannot swing the head from one extreme to the
other.

`taskState` is the durable memory between turns. It should be self-contained
enough for a later OpenAI request to know the user's goal, what Herbert has
observed, what he has already tried, and what he should do next.

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
id. Newly received messages are excluded when reading prior history for an
OpenAI request and appended after the OpenAI response is produced.
