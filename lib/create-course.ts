import { generateText } from "ai";
import type { CourseStructure, ModuleWithLessons } from "./types";
import { courseStructureSchema } from "./schemas";
import { createLessons, type CreateLessonsInput } from "./create-lesson";
import {
  createTogetherClient,
  DEFAULT_MODEL,
  getTogetherProviderOptions,
} from "./utils/together";
import { parseJSON } from "./utils/json";

export interface CourseProgressCallback {
  (type: string, message: string, data?: any): void;
}

export interface CreateModulesInput {
  content: string;
  apiKey: string;
  model?: string;
  maxRetries?: number;
  onProgress?: CourseProgressCallback;
}

export interface CreateCourseInput {
  content: string;
  apiKey: string;
  model?: string;
  validateStructure?: boolean;
  validateContent?: boolean;
  retryFailures?: boolean;
  maxRetries?: number;
  onProgress?: CourseProgressCallback;
}

export interface CourseOutput {
  title: string;
  modules: ModuleWithLessons[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate only the course structure (modules without lessons)
 */
export async function createModules({
  content,
  apiKey,
  model = DEFAULT_MODEL,
  maxRetries = 3,
  onProgress,
}: CreateModulesInput): Promise<CourseStructure> {
  onProgress?.("modules-start", "Generating course structure...");
  const together = createTogetherClient(apiKey);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateText({
        model: together(model),
        providerOptions: getTogetherProviderOptions(model),
        prompt: `Analyse the following content and create a course structure with 3 modules.
Respond ONLY with JSON. No other text.

{
  "title": "Course Title",
  "modules": [
    {"title": "Module 1 Title"},
    {"title": "Module 2 Title"},
    {"title": "Module 3 Title"}
  ]
}

Content:
${content}`,
      });

      const parsed = parseJSON(result.text);
      const validated = courseStructureSchema.safeParse(parsed);

      if (!validated.success) {
        throw new Error(
          `Invalid course structure: ${validated.error.issues.map((i) => i.message).join(", ")}`
        );
      }

      const modules = validated.data.modules;

      onProgress?.(
        "modules-complete",
        `Generated ${modules.length} modules`,
        { moduleCount: modules.length }
      );

      return {
        course: {
          title: validated.data.title,
          module: modules,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        onProgress?.(
          "modules-retry",
          `Course structure generation failed, retrying (${attempt}/${maxRetries})...`,
          { attempt, maxRetries, error: lastError.message }
        );
      }
    }
  }

  throw new Error(
    `Failed to generate course structure after ${maxRetries} attempts.\nLast error: ${lastError?.message}`
  );
}

/**
 * Detects transient errors from Together AI that should be retried at the
 * module level (not at the Zod-retry level). This includes request aborts,
 * rate-limit responses, 5xx server errors, and network connection failures.
 * Zod validation errors already have their own retry loop inside createLessons,
 * so they bypass this wrapper.
 */
function isTransientError(err: any): boolean {
  if (!err) return false;
  const name: string = err.name ?? "";
  const code: string = err.code ?? "";
  const msg: string = err.message ?? "";
  if (name === "AbortError" || code === "ABORT_ERR") return true;
  // Network-level errors from Node fetch/undici
  if (
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_SOCKET"
  ) {
    return true;
  }
  if (
    /aborted|service unavailable|too many requests|rate.?limit|network error|timeout|internal server error|unable to connect|fetch failed|socket hang up|connection (?:reset|closed)|502|503|504|500/i.test(
      msg
    )
  ) {
    return true;
  }
  // AI SDK wraps transient errors — check the inner cause chain.
  if (err.cause && isTransientError(err.cause)) return true;
  return false;
}

/**
 * Calls createLessons with a small retry loop for transient network errors
 * (aborts, rate limits, 5xx, connection failures). A short backoff gives
 * the provider time to recover.
 */
async function createLessonsWithTransientRetry(
  input: CreateLessonsInput,
  maxRetries = 3
): Promise<ModuleWithLessons> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await createLessons(input);
    } catch (err: any) {
      lastError = err;
      if (!isTransientError(err) || attempt > maxRetries) throw err;
      const delay = 2000 * attempt;
      console.warn(
        `  ⚠️  Transient error for module "${input.module.title}" (attempt ${attempt}/${maxRetries + 1}): ${err.message?.substring(0, 120) ?? err} — retrying in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Calls createModules with a transient retry wrapper. The inner createModules
 * already has its own 3-attempt retry loop for validation errors, but that
 * loop doesn't distinguish transient network errors from parse/Zod errors.
 * When Together AI has a bad burst (500s, connection drops), 3 attempts can
 * be exhausted in seconds. This outer wrapper adds backoff on transient
 * errors specifically.
 */
async function createModulesWithTransientRetry(
  input: CreateModulesInput,
  maxRetries = 3
): Promise<CourseStructure> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await createModules(input);
    } catch (err: any) {
      lastError = err;
      if (!isTransientError(err) || attempt > maxRetries) throw err;
      const delay = 2000 * attempt;
      console.warn(
        `  ⚠️  Transient error generating course structure (attempt ${attempt}/${maxRetries + 1}): ${err.message?.substring(0, 120) ?? err} — retrying in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Generate a complete course with modules and lessons
 */
export async function createCourse({
  content,
  apiKey,
  model = DEFAULT_MODEL,
  validateStructure = true,
  validateContent = true,
  retryFailures = true,
  maxRetries = 3,
  onProgress,
}: CreateCourseInput): Promise<CourseOutput> {
  const courseStructure = await createModulesWithTransientRetry({
    content,
    apiKey,
    model,
    maxRetries,
    onProgress,
  });
  const totalModules = courseStructure.course.module.length;
  onProgress?.(
    "lessons-start",
    `Generating lessons for ${totalModules} modules...`,
    { totalModules }
  );

  // Generate lessons sequentially so each module knows what questions were already
  // asked in previous modules, preventing duplicate questions across the course.
  const allModuleTitles = courseStructure.course.module.map((m) => m.title);
  const allLessons: ModuleWithLessons[] = [];
  const previousQuestions: string[] = [];
  let completedModules = 0;

  for (const [index, module] of courseStructure.course.module.entries()) {
    onProgress?.(
      "lessons-progress",
      `Generating lessons for module ${index + 1}/${totalModules}: "${module.title}"`,
      {
        completed: completedModules,
        total: totalModules,
        currentModule: index + 1,
        moduleTitle: module.title,
      }
    );

    const result = await createLessonsWithTransientRetry({
      module,
      content,
      apiKey,
      model,
      validateStructure,
      validateContent,
      retryFailures,
      maxRetries,
      previousQuestions: [...previousQuestions],
      allModuleTitles,
      onProgress: (type, message, data) => {
        if (type === "lesson-complete") {
          completedModules++;
          onProgress?.(
            "lessons-progress",
            `Generating lessons (${completedModules}/${totalModules} modules)`,
            {
              completed: completedModules,
              total: totalModules,
              currentModule: index + 1,
              moduleTitle: module.title,
            }
          );
        }
      },
    });

    allLessons.push(result);

    // Accumulate questions from successful lessons for dedup context
    for (const lr of result.lessons) {
      if (lr.success) {
        previousQuestions.push(lr.data.question);
      }
    }
  }

  let totalLessons = 0;
  let successfulLessons = 0;
  let failedLessons = 0;

  allLessons.forEach((module) => {
    module.lessons.forEach((lessonResult) => {
      totalLessons++;
      if (lessonResult.success) {
        successfulLessons++;
      } else {
        failedLessons++;
      }
    });
  });

  onProgress?.(
    "course-complete",
    `Course generation complete: ${successfulLessons}/${totalLessons} lessons successful`,
    {
      totalModules,
      totalLessons,
      successfulLessons,
      failedLessons,
      successRate: Math.round((successfulLessons / totalLessons) * 100),
    }
  );

  return {
    title: courseStructure.course.title,
    modules: allLessons,
  };
}
