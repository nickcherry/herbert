# OpenAI

The server package owns generic OpenAI API integration under
`packages/server/src/openai`. Domain-specific prompts, schemas, and assets
should live with their caller, not in the generic OpenAI folder.

## Environment

```sh
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` is a secret and belongs in env.

## Config

OpenAI defaults live in `packages/server/src/constants/openai.ts`.

- `defaultModel`: model used by callers that do not pass one.
- `defaultSchemaName`: fallback Structured Outputs schema name for callers that
  do not provide one.

If a new text caller is added, it should fall through to
`openaiConfig.defaultModel` rather than hardcoding a model version.

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

The caller must provide a Zod schema. The helper uses the OpenAI JavaScript
SDK's Responses API parser and `zodTextFormat`, then runs the parsed response
through the same schema before returning it.

Structured Outputs schemas should be compatible with OpenAI's supported subset.
In practice, use a root `z.object(...)` and keep fields required unless there is
a specific reason to model nullability.

Because `promptOpenAI` sends `text.format = zodTextFormat(schema, schemaName)`,
Responses API callers are using Structured Outputs rather than free-form text.
Domain prompts can still say "return JSON only" for readability and redundancy,
but the schema is the actual enforcement point.

## Domain Callers

`promptOpenAI` is intentionally domain-agnostic. A caller can ask about robot
navigation, generic scene analysis, document extraction, or any other structured
task; the OpenAI helper only handles request construction, image encoding, and
schema parsing.

Domain-specific behavior belongs outside `packages/server/src/openai`. That
keeps the generic helper reusable for a future robot task, a document extractor,
or any unrelated structured OpenAI call.

## Images

`promptOpenAI` accepts either:

- `imagePaths: string[]` - simple list, sent at `detail: "auto"`.
- `images: PromptImageInput[]` - fine-grained control, where each entry is
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
