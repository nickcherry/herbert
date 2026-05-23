# OpenAI

The server package owns OpenAI API integration under `packages/server/src/openai`.

## Environment

```sh
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` is a secret and belongs in env.

## Config

OpenAI defaults live in `packages/server/src/constants/openai.ts`.

- `defaultModel`: `gpt-5.5` — used for every chat/Responses-API call (Telegram
  task loop, structured prompts, anything that calls `promptOpenAI`).
- `includedBatchPhotoLimit`: maximum number of batch report photos the server
  attaches to a Telegram OpenAI turn (1 latest at full detail + up to
  `limit-1` earlier photos at lower detail).

Text generation runs on `gpt-5.5`. Speech synthesis is handled by ElevenLabs;
OpenAI only decides whether a response includes `spokenMessage` text. If a new
text caller is added, it should fall through to `openaiConfig.defaultModel`
rather than hardcoding a version.

## Prompt Helper

Use `promptOpenAI` for schema-first calls:

```ts
import { promptOpenAI } from "@herbert/server/openai";
import { z } from "zod";

const SceneSchema = z.object({
  summary: z.string(),
  hazards: z.array(z.string()),
});

const result = await promptOpenAI({
  prompt: "Describe Herbert's current view.",
  images: [
    { path: "/tmp/herbert/latest.jpg", detail: "high", label: "current view" },
  ],
  schema: SceneSchema,
  schemaName: "scene",
  logType: "scene_describe", // required: searchable type for openai_call_log
  logChatId: "123",           // optional
  logTaskId: "task-abc",      // optional
});
```

The caller must provide a Zod schema and a `logType`. The helper uses the
OpenAI JavaScript SDK's Responses API parser and `zodTextFormat`, runs the
parsed response through the same schema, and records the call (prompt,
instructions, image paths, parsed response or error, latency, and token usage
when available) to the `openai_call_log` SQLite table for later inspection.
Log-write failures are swallowed with a stderr warning so they never block the
returned response. Tests can stub logging by passing `log` (the
`OpenaiCallLog` interface).

Structured Outputs schemas should be compatible with OpenAI's supported subset.
In practice, use a root `z.object(...)` and keep fields required unless there is
a specific reason to model nullability.

## Telegram Response

Telegram admin messages use Structured Outputs with this root shape:

```ts
{
  telegramMessage: string | null;
  spokenMessage: string | null;
  taskState: string;
  isFinished: boolean;
  actions: Action[];
}
```

### Prompt structure

The system instructions (`telegramOpenAIInstructions`) are organized as
top-level XML sections, executive in tone:

- `<role>` — identity, British-chauffeur voice, the "every turn must move
  Herbert or change his view" mandate.
- `<truth_seeking>` — finish what the user asked, not a polite approximation
  of it. "Show me X" = the WHOLE subject in frame; step back if too close;
  hedged language means not done; camera at an extreme means move the body.
- `<movement>` — bigger movements by default; hard limits (`<limits>`); action
  list (`<actions>`); composition guidance (turn AND drive in one batch via
  `drive_arc`, or via `set_steering` + `drive`); close-quarters rules; hazard
  rules; the `distance_cm` heuristic; trust `ultrasonic_distance_cm` from
  batch reports over guessing.
- `<turn_model>` — each turn is independent; only `taskState` and batch
  reports carry over; image attachment order (floorplan first, batch photos
  next with the last one at full detail).
- `<response>` — `telegram_message`, `spoken_message`, `is_finished`
  semantics; the inspection-finish guard.
- `<special_commands>` — `/ping`, stop/halt, stop-only batches, unable
  responses.

The per-turn prompt body (`buildTelegramOpenAIPrompt`) emits exactly the
following top-level XML sections in order: `<floorplan>`, `<turn_context>`,
`<user_messages>`, `<herbert_responses>`, `<task_state>`, `<batch_reports>`.
There is no connective prose between them — the instructions describe what
each section means.

### Floorplan attachment

Every Telegram OpenAI turn attaches Herbert's apartment floorplan as the
first image at `detail: "high"`. The floorplan image embeds seven numbered
markers (1-7) matched to reference photos of each room, so the model can
localize batch photos against the layout. The floorplan is NOT counted in
`<attached_image_count>`; that count continues to mean "batch report photos
attached on this turn":

```xml
<floorplan>
  <address>22 North 6th Street, Unit 10C</address>
  <rooms>
    <room number="1" name="Living / Dining Room" dimensions="27'9&quot; x 12'9&quot;" />
    ...
  </rooms>
  <other_features>...</other_features>
  <usage>...NOT Herbert's current view.</usage>
</floorplan>
```

The image file lives at `packages/server/src/openai/assets/floorplan.jpg` and
the path is resolved via `resolveFloorplanImagePath` so it works regardless of
the process's cwd. To update the floorplan, replace that file and adjust the
`<rooms>` list in `buildTelegramOpenAIPrompt.ts` if the markers change.

### Other body sections

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
    <text>drive forward</text>
    <timestamp>2026-05-21 17:39:56</timestamp>
    <is_new>1</is_new>
  </message>
</user_messages>
```

```xml
<herbert_responses>
  <response>
    <timestamp>2026-05-21 17:40:02</timestamp>
    <telegram_message>Driving forward.</telegram_message>
    <spoken_message>A modest reconnaissance, then.</spoken_message>
  </response>
</herbert_responses>
```

`trigger` is `telegram_messages` when a poll delivered new admin messages and
`batch_complete` when Herbert has just completed an action batch and returned
a photo. On `batch_complete` turns, there are usually no new Telegram messages;
the model must continue from `taskState` and the latest batch report.

The schema is defined in `packages/server/src/telegram/telegramOpenAIResponse.ts`.
It uses `z.union` for action variants so the OpenAI SDK emits nested `anyOf`,
which is supported by Structured Outputs. Do not replace it with
`z.discriminatedUnion` unless the emitted JSON Schema is checked again; the
current SDK emits `oneOf` for discriminated unions.

The OpenAI schema only includes constraints supported by Structured Outputs.
Telegram reply length, spoken message length, task state length, no-op active
responses, and `isFinished`/actions consistency are validated after parsing
before the response is used.

Movement actions are bounded more narrowly than the low-level robot bridge:

- speed: `50..100`
- drive duration: `1000..5000` ms
- steering angle: `-30..30`
- camera deltas: `-10..10`

The drive `speed` and `durationMs` floors are deliberate. They force every
drive action to cover roughly 25 cm or more — smaller pulses are timid noise
in apartment-scale spaces, and the response schema rejects them outright.
Close-quarters control (within ~30 cm of an obstacle) is done with
`stop`, `take_photo`, `look`, or `set_steering`, not smaller drives.

The `-30..30` steering bound follows the PiCar-X v2.0 SDK direction servo
constants, even though Herbert's low-level bridge currently accepts `-35..35`.
`drive` is straight; use `drive_arc` to move while steering. `set_steering`
turns the front wheels in place without moving the robot.

Drive distance is open-loop, not measured. The prompt gives the model a rough
straight-line estimate of `distance_cm ~= 50 * (speed / 100) * seconds` so it
does not choose movement pulses too small to matter. Batch reports can also
include absolute camera pan/tilt and an `ultrasonic_distance_cm` reading
taken at batch completion (see [ROBOT.md](./ROBOT.md)). The prompt instructs
the model to treat `ultrasonic_distance_cm` as ground truth for clearance
ahead rather than guessing from the photo.

## Call Log

Every call to `promptOpenAI` is recorded to the `openai_call_log` SQLite
table. The caller must pass a `logType` (free-form string, e.g.
`"telegram_robot_turn"`) and may pass `logChatId` / `logTaskId` for
correlation. Each row stores:

- `id`, `created_at_ms`, `type`
- `model`, `schema_name`, `chat_id`, `task_id`
- `instructions`, `prompt`, `image_paths_json` (array of file paths, not the
  image bytes themselves)
- `response_json` (raw parsed structured-output) or `error_message` on
  failure
- `latency_ms`, `input_tokens`, `output_tokens` (when reported by the API)

Indexes on `(created_at_ms)`, `(type, created_at_ms)`, and
`(chat_id, created_at_ms)` keep filtered queries cheap. Use
`SqliteOpenaiCallLog#list({ type?, chatId?, taskId?, sinceMs?, limit? })`
to query.

Log-write failures are swallowed with a stderr warning so logging never
blocks the call's return value. See [PERSISTENCE.md](./PERSISTENCE.md) for
the table schema and the `OpenaiCallLog` interface.

## Spoken Commentary

`spokenMessage` is selected by OpenAI but synthesized by ElevenLabs server-side
and played out of the machine running `server:start` (the Mac mini or laptop
near the robot). It is never sent to the robot — the robot only executes action
batches.

OpenAI prompt guidance for `spokenMessage`:

- Use it for sparse physical Herbert flavor: a quick spoken aside that brings
  the scene to life.
- In addition to reacting to the environment, Herbert may occasionally offer a
  brief anecdote, make commentary on the room, or add a dry witticism when it
  fits the moment.
- Use null unless a spoken line would add charm without distracting from the
  task.
- Keep it at or under 800 characters.
- Keep all operational information in `telegramMessage`.
- Avoid urgent, time-sensitive, or frame-perfect remarks because audio is
  based on a completed action batch/photo and usually plays 5-10 seconds after
  Herbert's last physical action.

See [ElevenLabs](./ELEVENLABS.md) for speech synthesis configuration and
`audio:test`.

## Images

`promptOpenAI` accepts either:

- `imagePaths: string[]` — simple list, sent at `detail: "auto"`.
- `images: PromptImageInput[]` — fine-grained control, where each entry is
  `{ path, detail?, label? }`. The label is emitted as an `input_text` block
  immediately before the image so the model can attribute each picture.

The Telegram task loop uses the `images` form. On a `batch_complete` turn it
sends the latest batch report photo at `detail: "high"` and up to
`includedBatchPhotoLimit - 1` earlier batch report photos at `detail: "low"`.
OpenAI processes `low`-detail images at a fixed lower resolution, so older
photos cost far fewer tokens than the current view while still giving the
model continuity across batches. Each image's label identifies its batch
report so the model knows which photo is the current view and which are
older.

Supported extensions:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`

Sources:

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses&lang=javascript)
- [OpenAI image input detail levels](https://platform.openai.com/docs/guides/vision)
- [SunFounder PiCar-X movement docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_move.html)
- [SunFounder PiCar-X SDK source](https://github.com/sunfounder/picar-x/blob/v2.0/picarx/picarx.py)
