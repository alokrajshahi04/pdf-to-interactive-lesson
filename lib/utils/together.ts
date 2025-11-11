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
export const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.1";
