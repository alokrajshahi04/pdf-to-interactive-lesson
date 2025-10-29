import { createTogetherAI } from "@ai-sdk/togetherai";

/**
 * Shared Together AI client instance
 * Used across all AI generation functions
 */
export const together = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});

/**
 * Default model for course and lesson generation
 */
export const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.1";
