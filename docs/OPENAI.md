# OpenAI

The server package owns generic OpenAI API integration under
`packages/server/src/openai`. Domain-specific prompts, schemas, and assets live
with their caller. For example, Herbert's Telegram robot prompt and floorplan
reference live under `packages/server/src/telegram`.

## Environment

```sh
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` is a secret and belongs in env.

## Config

OpenAI defaults live in `packages/server/src/constants/openai.ts`.

- `defaultModel`: `gpt-5.5` — used for every chat/Responses-API call (Telegram
  task loop, structured prompts, anything that calls `promptOpenAI`).
- `defaultSchemaName`: fallback Structured Outputs schema name for callers that
  do not provide one.

Text generation runs on `gpt-5.5`. Speech synthesis is handled separately by
ElevenLabs; `promptOpenAI` is only responsible for text/image Responses API
calls. If a new text caller is added, it should fall through to
`openaiConfig.defaultModel` rather than hardcoding a version.

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

## Domain Callers

`promptOpenAI` is intentionally domain-agnostic. A caller can ask about robot
navigation, generic scene analysis, document extraction, or any other structured
task; the OpenAI helper only handles request construction, image encoding,
schema parsing, and call logging.

Telegram-specific behavior is documented in [Telegram](./TELEGRAM.md): the
Herbert prompt, response schema, floorplan asset, batch-photo policy, and robot
action contract all belong to that domain.

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

## Images

`promptOpenAI` accepts either:

- `imagePaths: string[]` — simple list, sent at `detail: "auto"`.
- `images: PromptImageInput[]` — fine-grained control, where each entry is
  `{ path, detail?, label? }`. The label is emitted as an `input_text` block
  immediately before the image so the model can attribute each picture.

Use `images` when a caller needs per-image labels or detail levels. OpenAI
processes `low`-detail images at a fixed lower resolution, which reduces token
cost when full visual detail is unnecessary.

Supported extensions:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`

Sources:

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses&lang=javascript)
- [OpenAI image input detail levels](https://platform.openai.com/docs/guides/vision)
