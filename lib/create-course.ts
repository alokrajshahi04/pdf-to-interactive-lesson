import { generateText } from "ai";
import type { CourseStructure, ModuleWithLessons } from "./types";
import { extractXml, createXMLParser } from "./utils/xml";
import { createLessons } from "./create-lesson";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";

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
Respond only with XML format. Do not include any other text.
Your response should ONLY contain the XML format following this structure:

<course title="Course Title">
  <module title="Module 1 Title" />
  <module title="Module 2 Title" />
  <module title="Module 3 Title" />
</course>

Content:
${content}`,
      });

      // Extract XML in case there's extra text
      let xmlText: string;
      try {
        xmlText = extractXml(result.text, "course");
      } catch {
        throw new Error(
          `Model returned invalid response (no XML found).\n` +
          `Response preview: ${result.text.substring(0, 200)}...`
        );
      }

      // Parse XML to JavaScript object
      const parser = createXMLParser(["module"]);
      const courseStructure = parser.parse(xmlText);

      // Validate the parsed structure
      if (!courseStructure?.course?.module) {
        throw new Error(
          `Model returned invalid course structure.\n` +
          `Expected: <course><module>...</module></course>\n` +
          `Response preview: ${result.text.substring(0, 200)}...`
        );
      }

      // Ensure module is always an array
      const modules = Array.isArray(courseStructure.course.module) 
        ? courseStructure.course.module 
        : [courseStructure.course.module];

      onProgress?.("modules-complete", `Generated ${modules.length} modules`, {
        moduleCount: modules.length,
      });

      return {
        ...courseStructure,
        course: {
          ...courseStructure.course,
          module: modules,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        onProgress?.("modules-retry", `Course structure generation failed, retrying (${attempt}/${maxRetries})...`, {
          attempt,
          maxRetries,
          error: lastError.message,
        });
      }
    }
  }
  
  // All retries exhausted
  throw new Error(
    `Failed to generate course structure after ${maxRetries} attempts.\n` +
    `Last error: ${lastError?.message}`
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
  // Generate course modules
  const courseStructure = await createModules({ content, apiKey, model, maxRetries, onProgress });
  const totalModules = courseStructure.course.module.length;
  onProgress?.("lessons-start", `Generating lessons for ${totalModules} modules...`, {
    totalModules,
  });

  // Generate lessons for all modules in parallel with progress tracking
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
        // Forward progress from createLessons
        if (type === "lesson-complete") {
          completedModules++;
          onProgress?.("lessons-progress", `Generating lessons (${completedModules}/${totalModules} modules)`, {
            completed: completedModules,
            total: totalModules,
            currentModule: index + 1,
            moduleTitle: module.title,
          });
        } else if (type === "lesson-start") {
          onProgress?.("lessons-progress", `Generating lessons for module ${index + 1}/${totalModules}: "${module.title}"`, {
            completed: completedModules,
            total: totalModules,
            currentModule: index + 1,
            moduleTitle: module.title,
          });
        }
      },
    })
  );

  const allLessons = await Promise.all(lessonsPromises);
  
  // Calculate final statistics
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
  
  onProgress?.("course-complete", `Course generation complete: ${successfulLessons}/${totalLessons} lessons successful`, {
    totalModules,
    totalLessons,
    successfulLessons,
    failedLessons,
    successRate: Math.round((successfulLessons / totalLessons) * 100),
  });

  return {
    title: courseStructure.course.title,
    modules: allLessons,
  };
}
