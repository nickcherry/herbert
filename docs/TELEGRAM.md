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
  admin chat id, and additionally drops any message older than
  `telegramConfig.openAIContextMessageMaxAgeMs` (default: 3 minutes) before
  building the OpenAI prompt. Stale history is never replayed to the model.
- `telegramConfig.openAIBatchPhotoLimit` controls how many batch report photos
  are attached to a Telegram OpenAI turn.

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
  actions: RobotTaskAction[];
}
```

`telegramMessage` is sent back to Telegram when present. `spokenMessage` is
synthesized to audio server-side via ElevenLabs and played out of the host
running `server:start` (see [ELEVENLABS.md](./ELEVENLABS.md)) — it
is never sent to the robot. `taskState` is persisted for multi-turn robot
work. `isFinished` closes the active task for that chat and must be paired
with an empty action list.

The Telegram domain owns Herbert's OpenAI prompt and robot-specific reference
assets. `promptTelegramOpenAI.ts` builds the OpenAI call, `buildTelegramOpenAIPrompt.ts`
formats the per-turn XML body, `telegramOpenAIResponse.ts` defines the response
schema, and `assets/floorplan.jpg` is the static floorplan reference. The
generic OpenAI helper under `packages/server/src/openai` should stay reusable
for any structured OpenAI task.

When actions are returned, the server queues them as a robot action batch in
SQLite. Herbert's robot process polls the queue, executes the batch, captures an
end-of-batch photo, and reports completion back to the server. That photo and
the completed actions become the next OpenAI turn's latest batch report.

User message context is formatted as XML:

```xml
<turn_context>
  <trigger>telegram_messages</trigger>
  <new_message_count>1</new_message_count>
  <batch_report_count>0</batch_report_count>
  <attached_image_count>0</attached_image_count>
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

Herbert's own recent outputs are included separately so the model knows what
Herbert already sent to Telegram and what he already spoke aloud:

```xml
<herbert_responses>
  <response>
    <timestamp>2026-05-21 17:40:02</timestamp>
    <telegram_message>Driving forward.</telegram_message>
    <spoken_message>A modest reconnaissance, then.</spoken_message>
  </response>
</herbert_responses>
```

Batch reports are also formatted as XML. When the turn trigger is
`batch_complete`, there are usually no new Telegram messages; OpenAI should
continue from `taskState`, the batch report XML, and the attached photos. The
latest batch report photo is attached at `detail: "high"` (Herbert's current
view) and up to `telegramConfig.openAIBatchPhotoLimit - 1` earlier batch
report photos are attached at `detail: "low"` (downsampled by OpenAI for
continuity at lower token cost). Each attached image is preceded by a label
identifying which batch report it belongs to. Batch reports beyond the photo
cap are still listed in the XML with their `photo_path` but have no attached
image on that turn.

When the robot worker completes a batch, it also reports Herbert's current
absolute camera pan/tilt when available. That position is persisted on the
batch report and rendered as `<camera_position>` so OpenAI can tell when a
series of `look` actions has already pushed the camera toward a limit.

### Prompt Structure

The system instructions (`telegramOpenAIInstructions`) are organized as
top-level XML sections:

- `<role>` — Herbert's identity, British-chauffeur voice, evidence-grounding,
  and the rule that show/look requests are satisfied by photos.
- `<turn>` — turn triggers, persistence model, and image attachment order.
- `<actions>` — robot action inventory, hard limits, distance estimates, and
  action composition guidance.
- `<movement_policy>` — default movement bias, hazard rules, user overrides,
  and below-minimum-drive behavior.
- `<response>` — JSON-only output format, exact TypeScript response shape,
  `telegramMessage`, `spokenMessage`, `taskState`, `isFinished`, action
  semantics, and the action-required rule.
- `<special_commands>` — `/ping`, stop/halt, stop-only batches, and unable
  responses.

The per-turn prompt body (`buildTelegramOpenAIPrompt`) emits exactly the
following top-level XML sections in order: `<floorplan>`, `<turn_context>`,
`<user_messages>`, `<herbert_responses>`, `<task_state>`, `<batch_reports>`.
There is no connective prose between them; the system instructions describe
what each section means.

The precision rule is deliberately evidence-based: claims about Herbert's
current environment must be grounded in robot photos and batch reports actually
present in the prompt. The floorplan is only static layout and route context,
not evidence of Herbert's current view.

### Floorplan Attachment

Every Telegram OpenAI turn attaches Herbert's apartment floorplan as the first
image at `detail: "high"`. The floorplan image embeds seven numbered markers
(1-7) matched to reference photos of each room, so the model can localize batch
photos against the layout. The floorplan is NOT counted in
`<attached_image_count>`; that count means "batch report photos attached on
this turn":

```xml
<floorplan>
  <rooms>
    <room number="1" name="Living / Dining Room" dimensions="27'9&quot; x 12'9&quot;" />
    ...
  </rooms>
  <other_features>...</other_features>
  <usage>...NOT Herbert's current view.</usage>
</floorplan>
```

The image file lives at `packages/server/src/telegram/assets/floorplan.jpg` and
the path is resolved by `packages/server/src/telegram/resolveFloorplanImagePath.ts`
so it works regardless of the process's cwd. To update the floorplan, replace
that file and adjust the `<rooms>` list in `buildTelegramOpenAIPrompt.ts` if
the markers change.

### Response Schema

The schema is defined in `packages/server/src/telegram/telegramOpenAIResponse.ts`.
`promptOpenAI` sends that schema to the Responses API through `zodTextFormat`,
so OpenAI is asked for Structured Outputs rather than free-form text. The
Telegram instructions also explicitly say to return JSON only and include
`telegramOpenAIResponseTypeScript`, a TypeScript view of the expected response
object, so the prompt is readable even before looking at the Zod schema.

Current response shape:

```ts
type TelegramOpenAIResponse = {
  telegramMessage: string | null;
  spokenMessage: string | null;
  taskState: string;
  isFinished: boolean;
  actions: RobotTaskAction[];
};

type RobotTaskAction =
  | {
      type: "drive";
      direction: "forward" | "backward";
      speed: number;
      durationMs: number;
    }
  | {
      type: "drive_arc";
      direction: "forward" | "backward";
      angle: number;
      speed: number;
      durationMs: number;
    }
  | { type: "set_steering"; angle: number }
  | { type: "look"; panDelta: number; tiltDelta: number }
  | { type: "take_photo" }
  | { type: "stop" };
```

The action variants use `z.union` so the OpenAI SDK emits nested `anyOf`, which
is supported by Structured Outputs. Do not replace it with
`z.discriminatedUnion` unless the emitted JSON Schema is checked again; the
current SDK emits `oneOf` for discriminated unions.

The OpenAI schema only includes constraints supported by Structured Outputs.
Telegram reply length, spoken message length, task state length, no-op active
responses, and `isFinished`/actions consistency are validated after parsing
before the response is used.

The OpenAI-facing action contract is deliberately narrower than the low-level
Python bridge:

- `drive`: `direction` is `forward` or `backward`, `speed` is `50..100`, and
  `durationMs` is `1000..5000`. This is straight driving; the robot worker centers
  steering first. The lower bounds are intentional and force every drive to
  cover roughly 25 cm or more.
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

Drive distance is not measured directly. `speed` is approximate motor power, and
the prompt gives OpenAI the rough straight-line heuristic
`distance_cm ~= 50 * (speed / 100) * (durationMs / 1000)`, so `speed=100` for
`5000ms` is about `250cm` before floor, battery, traction, and steering effects.
The schema floors (`speed >= 50`, `durationMs >= 1000`) put the minimum
possible drive at roughly 25 cm, so the model can't choose timid pulses even
if it wanted to. Close-quarters control happens through `stop`, `take_photo`,
`look`, and `set_steering` instead.

`taskState` is the durable memory between turns. It should be self-contained
enough for a later OpenAI request to know the user's goal, what Herbert has
observed, what he has already tried, and what he should do next.

## Spoken Commentary

`spokenMessage` is selected by OpenAI but synthesized by ElevenLabs server-side
and played out of the machine running `server:start` (the Mac mini or laptop
near the robot). It is never sent to the robot — the robot only executes action
batches.

Prompt guidance for `spokenMessage`:

- Use null unless a spoken line genuinely adds charm without distracting from
  the task.
- Keep all operational information in `telegramMessage`.
- Keep it at or under 800 characters.
- Phrase it so it still makes sense 5-10 seconds after the last action.
- Avoid urgent, time-sensitive, or frame-perfect remarks.

See [ElevenLabs](./ELEVENLABS.md) for speech synthesis configuration and
`audio:test`.

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
