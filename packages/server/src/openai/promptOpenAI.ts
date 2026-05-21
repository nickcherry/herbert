import { openaiConfig } from "@herbert/server/constants/openai";
import { buildPromptInputContent } from "@herbert/server/openai/buildPromptInputContent";
import { createOpenAIClient } from "@herbert/server/openai/createOpenAIClient";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { type z } from "zod";

export interface PromptOpenAIOptions<Schema extends z.ZodType> {
  readonly prompt: string;
  readonly schema: Schema;
  readonly schemaName?: string;
  readonly imagePaths?: readonly string[];
  readonly model?: string;
  readonly instructions?: string;
  readonly client?: OpenAI;
}

export async function promptOpenAI<Schema extends z.ZodType>({
  prompt,
  schema,
  schemaName = openaiConfig.defaultSchemaName,
  imagePaths = [],
  model = openaiConfig.defaultModel,
  instructions,
  client = createOpenAIClient(),
}: PromptOpenAIOptions<Schema>): Promise<z.infer<Schema>> {
  const input = [
    {
      role: "user" as const,
      content: await buildPromptInputContent({ prompt, imagePaths }),
    },
  ];

  const response = await client.responses.parse({
    model,
    input,
    ...(instructions === undefined ? {} : { instructions }),
    text: {
      format: zodTextFormat(schema, schemaName),
    },
  });

  if (response.output_parsed === null) {
    throw new Error("OpenAI response did not include parsed output.");
  }

  return schema.parse(response.output_parsed);
}
