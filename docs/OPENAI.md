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

## Telegram Admin Response

Telegram admin messages use Structured Outputs with this root shape:

```ts
{
  message: string;
  actions: Action[];
}
```

The schema is defined in `packages/server/src/telegram/telegramOpenAIResponse.ts`.
It uses `z.union` for action variants so the OpenAI SDK emits nested `anyOf`,
which is supported by Structured Outputs. Do not replace it with
`z.discriminatedUnion` unless the emitted JSON Schema is checked again; the
current SDK emits `oneOf` for discriminated unions.

The OpenAI schema only includes constraints supported by Structured Outputs.
Telegram reply length is validated after parsing before the response is used.
Robot speech is intentionally not part of the Telegram action contract.

Movement action parameters are bounded more narrowly than the low-level robot
bridge:

- speed: `1..50`
- drive duration: `100..1000` ms
- steering angle: `-30..30`
- camera deltas: `-10..10`

The `-30..30` steering bound follows the PiCar-X v2.0 SDK direction servo
constants, even though Herbert's low-level bridge currently accepts `-35..35`.

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
- [SunFounder PiCar-X movement docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_move.html)
- [SunFounder PiCar-X SDK source](https://github.com/sunfounder/picar-x/blob/v2.0/picarx/picarx.py)
