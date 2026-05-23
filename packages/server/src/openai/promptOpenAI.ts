import { openaiConfig } from "@herbert/server/constants/openai";
import {
  buildPromptInputContent,
  type PromptImageInput,
} from "@herbert/server/openai/buildPromptInputContent";
import { createOpenAIClient } from "@herbert/server/openai/createOpenAIClient";
import { defaultOpenaiCallLog } from "@herbert/server/persistence/openaiCallLog/defaultOpenaiCallLog";
import type { OpenaiCallLog } from "@herbert/server/persistence/openaiCallLog/openaiCallLog";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { type z } from "zod";

export interface PromptOpenAIOptions<Schema extends z.ZodType> {
  readonly prompt: string;
  readonly schema: Schema;
  readonly schemaName?: string;
  readonly imagePaths?: readonly string[];
  readonly images?: readonly PromptImageInput[];
  readonly model?: string;
  readonly instructions?: string;
  readonly client?: OpenAI;
  /** Required so every call is searchable by kind. */
  readonly logType: string;
  /** Optional context recorded alongside the call. */
  readonly logChatId?: string;
  readonly logTaskId?: string;
  /** Defaults to the SQLite-backed call log. Pass a stub from tests. */
  readonly log?: OpenaiCallLog;
}

export async function promptOpenAI<Schema extends z.ZodType>({
  prompt,
  schema,
  schemaName = openaiConfig.defaultSchemaName,
  imagePaths,
  images,
  model = openaiConfig.defaultModel,
  instructions,
  client = createOpenAIClient(),
  logType,
  logChatId,
  logTaskId,
  log = defaultOpenaiCallLog(),
}: PromptOpenAIOptions<Schema>): Promise<z.infer<Schema>> {
  const input = [
    {
      role: "user" as const,
      content: await buildPromptInputContent({ prompt, imagePaths, images }),
    },
  ];

  const startedAtMs = Date.now();
  const resolvedImagePaths = collectImagePaths({ imagePaths, images });

  try {
    const response = await client.responses.parse({
      model,
      input,
      ...(instructions === undefined ? {} : { instructions }),
      text: {
        format: zodTextFormat(schema, schemaName),
      },
    });

    if (response.output_parsed === null) {
      const finishedAtMs = Date.now();
      await safelyLog({
        log,
        entry: {
          createdAtMs: startedAtMs,
          type: logType,
          model,
          schemaName,
          chatId: logChatId ?? null,
          taskId: logTaskId ?? null,
          instructions: instructions ?? null,
          prompt,
          imagePaths: resolvedImagePaths,
          responseJson: null,
          errorMessage: "missing_parsed_output",
          latencyMs: finishedAtMs - startedAtMs,
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null,
        },
      });
      throw new Error("OpenAI response did not include parsed output.");
    }

    const parsed = schema.parse(response.output_parsed);
    const finishedAtMs = Date.now();

    await safelyLog({
      log,
      entry: {
        createdAtMs: startedAtMs,
        type: logType,
        model,
        schemaName,
        chatId: logChatId ?? null,
        taskId: logTaskId ?? null,
        instructions: instructions ?? null,
        prompt,
        imagePaths: resolvedImagePaths,
        responseJson: JSON.stringify(response.output_parsed),
        errorMessage: null,
        latencyMs: finishedAtMs - startedAtMs,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    });

    return parsed;
  } catch (error) {
    const finishedAtMs = Date.now();
    await safelyLog({
      log,
      entry: {
        createdAtMs: startedAtMs,
        type: logType,
        model,
        schemaName,
        chatId: logChatId ?? null,
        taskId: logTaskId ?? null,
        instructions: instructions ?? null,
        prompt,
        imagePaths: resolvedImagePaths,
        responseJson: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs: finishedAtMs - startedAtMs,
        inputTokens: null,
        outputTokens: null,
      },
    });
    throw error;
  }
}

function collectImagePaths({
  imagePaths,
  images,
}: {
  readonly imagePaths?: readonly string[];
  readonly images?: readonly PromptImageInput[];
}): readonly string[] {
  if (images !== undefined) {
    return images.map((image) => image.path);
  }
  return imagePaths ?? [];
}

async function safelyLog({
  log,
  entry,
}: {
  readonly log: OpenaiCallLog;
  readonly entry: Parameters<OpenaiCallLog["append"]>[0];
}): Promise<void> {
  try {
    await log.append(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`openai call log append failed: ${message}\n`);
  }
}
