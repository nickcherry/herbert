# OpenAI

The server package owns OpenAI API integration under `packages/server/src/openai`.

## Environment

```sh
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` is a secret and belongs in env.

## Config

OpenAI defaults live in `packages/server/src/constants/openai.ts`.

The default prompt model is `gpt-5.4-mini`, chosen as a fast, efficient model
with text and image input plus structured output support.

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
  imagePaths: ["/tmp/herbert/latest.jpg"],
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

## Images

`imagePaths` accepts local image paths. The helper reads each file and sends it
as an `input_image` data URL.

Supported extensions:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`

Sources:

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses&lang=javascript)
- [OpenAI GPT-5.4 mini model](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
