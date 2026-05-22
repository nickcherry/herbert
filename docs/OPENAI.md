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
- `defaultSpeechModel`: `gpt-5.5-mini-tts` — used for server-side
  text-to-speech synthesis of Herbert's `spokenMessage`.
- `defaultSpeechVoice`: `fable` — OpenAI voice preset that pairs naturally
  with Herbert's tiny British chauffeur personality.
- `defaultSpeechFormat`: `mp3` — output container for synthesized audio.
- `includedCommentaryPhotoLimit`: maximum number of commentary photos the
  server attaches to a Telegram OpenAI turn (1 latest at full detail + up to
  `limit-1` earlier photos at lower detail).

Everything OpenAI-related runs on `gpt-5.5`. If a new caller is added, it
should fall through to `openaiConfig.defaultModel` rather than hardcoding a
version.

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
});
```

The caller must provide a Zod schema. The helper uses the OpenAI JavaScript SDK's
Responses API parser and `zodTextFormat`, then runs the parsed response through
the same schema before returning.

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

The prompt content includes turn metadata, prior same-chat context, newly
received messages, task state, and robot commentary:

```xml
<turn_context>
  <trigger>telegram_messages</trigger>
  <new_message_count>1</new_message_count>
  <robot_commentary_count>0</robot_commentary_count>
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

`trigger` is `telegram_messages` when a poll delivered new admin messages and
`robot_commentary` when Herbert has just completed an action batch and returned
a photo. On robot commentary turns, there are usually no new Telegram messages;
the model must continue from `taskState` and the latest commentary entry.

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

- speed: `1..50`
- drive duration: `100..1000` ms
- steering angle: `-30..30`
- camera deltas: `-10..10`

The `-30..30` steering bound follows the PiCar-X v2.0 SDK direction servo
constants, even though Herbert's low-level bridge currently accepts `-35..35`.
`drive` is straight; use `drive_arc` to move while steering. `set_steering`
turns the front wheels in place without moving the robot.

## Spoken Commentary

`spokenMessage` is synthesized to audio server-side and played out of the
machine running `server:start` (the Mac mini or laptop near the robot). It is
never sent to the robot — the robot only executes action batches.

Server flow when `spokenMessage` is non-null:

1. `handleRobotTaskResponse` calls `synthesizeSpeech` with the text.
2. `synthesizeSpeech` calls `client.audio.speech.create` against
   `openaiConfig.defaultSpeechModel` with `openaiConfig.defaultSpeechVoice` and
   writes the audio to a temp file.
3. `playAudioFile` invokes the platform audio player (`afplay` on macOS,
   `aplay` on Linux) as a fire-and-forget child process so it doesn't block
   the next Telegram turn.

Playback errors are logged but never surfaced to the user — the Telegram
response and queued robot actions still flow normally if audio is unavailable.

## Images

`promptOpenAI` accepts either:

- `imagePaths: string[]` — simple list, sent at `detail: "auto"`.
- `images: PromptImageInput[]` — fine-grained control, where each entry is
  `{ path, detail?, label? }`. The label is emitted as an `input_text` block
  immediately before the image so the model can attribute each picture.

The Telegram task loop uses the `images` form. On a `robot_commentary` turn it
sends the latest commentary photo at `detail: "high"` and up to
`includedCommentaryPhotoLimit - 1` earlier commentary photos at `detail:
"low"`. OpenAI processes `low`-detail images at a fixed lower resolution, so
older photos cost far fewer tokens than the current view while still giving
the model continuity across batches. Each image's label identifies its
commentary entry so the model knows which photo is the current view and which
are older.

Supported extensions:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`

Sources:

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses&lang=javascript)
- [OpenAI image input detail levels](https://platform.openai.com/docs/guides/vision)
- [OpenAI text-to-speech](https://platform.openai.com/docs/guides/text-to-speech)
- [SunFounder PiCar-X movement docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_move.html)
- [SunFounder PiCar-X SDK source](https://github.com/sunfounder/picar-x/blob/v2.0/picarx/picarx.py)
