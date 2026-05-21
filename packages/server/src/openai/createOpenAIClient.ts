import { env } from "@herbert/server/constants/env";
import OpenAI from "openai";

export function createOpenAIClient(): OpenAI {
  const apiKey = env.openaiApiKey;

  if (apiKey === undefined) {
    throw new Error("OPENAI_API_KEY is not set in the environment.");
  }

  return new OpenAI({ apiKey });
}
