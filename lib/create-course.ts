import { generateText } from "ai";
import type { CourseStructure, ModuleWithLessons } from "./types";
import { courseStructureSchema } from "./schemas";
import { createLessons } from "./create-lesson";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";
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
  const courseStructure = await createModules({
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

  let completedModules = 0;
  const lessonsPromises = courseStructure.course.module.map((module, index) =>
    createLessons({
      module,
      content,
      apiKey,
      model,
      validateStructure,
      validateContent,
      retryFailures,
      maxRetries,
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
        } else if (type === "lesson-start") {
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
        }
      },
    })
  );

  const allLessons = await Promise.all(lessonsPromises);

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
