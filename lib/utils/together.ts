import { createTogetherAI } from "@ai-sdk/togetherai";

/**
 * Create a Together AI client with the provided API key
 */
export function createTogetherClient(apiKey: string) {
  return createTogetherAI({
    apiKey,
  });
}

/**
 * Legacy: Shared Together AI client instance using env variable
 * @deprecated Use createTogetherClient(apiKey) instead
 */
export const together = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});

/**
 * Default model for course and lesson generation
 */
export const DEFAULT_MODEL = "zai-org/GLM-4.6";

/**
 * Available models for course generation
 */
export const AVAILABLE_MODELS = {
  "deepseek-3.1": "deepseek-ai/DeepSeek-V3.1",
  "glm-4.6": "zai-org/GLM-4.6",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "kimi-k2-thinking": "moonshotai/Kimi-K2-Thinking",
} as const;

export type ModelAlias = keyof typeof AVAILABLE_MODELS;
