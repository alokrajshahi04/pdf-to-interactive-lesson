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
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Single source of truth for model configuration
 * Pricing is per 1M tokens (input, output in USD)
 */
export const MODEL_CONFIG = {
  "deepseek-3.1": {
    fullName: "deepseek-ai/DeepSeek-V3.1",
    pricing: { input: 0.60, output: 1.70 },
  },
  "glm-4.6": {
    fullName: "zai-org/GLM-4.6",
    pricing: { input: 0.60, output: 2.20 },
  },
  "gpt-oss-120b": {
    fullName: "openai/gpt-oss-120b",
    pricing: { input: 0.15, output: 0.60 },
  },
} as const;

export type ModelAlias = keyof typeof MODEL_CONFIG;

/**
 * Available models for course generation (derived from MODEL_CONFIG)
 */
export const AVAILABLE_MODELS = Object.fromEntries(
  Object.entries(MODEL_CONFIG).map(([alias, config]) => [alias, config.fullName])
) as Record<ModelAlias, string>;

/**
 * Get pricing for a model by alias or full name
 * @returns Pricing object or undefined if not found
 */
export function getModelPricing(model: string): { input: number; output: number } | undefined {
  // Check if it's an alias
  if (model in MODEL_CONFIG) {
    return MODEL_CONFIG[model as ModelAlias].pricing;
  }
  // Check if it's a full name
  const entry = Object.values(MODEL_CONFIG).find((c) => c.fullName === model);
  return entry?.pricing;
}
