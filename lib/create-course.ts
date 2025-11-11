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
  onProgress?: CourseProgressCallback;
}

export interface CreateCourseInput {
  content: string;
  apiKey: string;
  validateStructure?: boolean;
  validateContent?: boolean;
  retryFailures?: boolean;
  maxRetries?: number;
  onProgress?: CourseProgressCallback;
}

export interface CourseOutput {
  title: string;
  modules: ModuleWithLessons[];
}

/**
 * Generate only the course structure (modules without lessons)
 */
export async function createModules({
  content,
  apiKey,
  onProgress,
}: CreateModulesInput): Promise<CourseStructure> {
  onProgress?.("modules-start", "Generating course structure...");
  const together = createTogetherClient(apiKey);
  const result = await generateText({
    model: together(DEFAULT_MODEL),
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
  const xmlText = extractXml(result.text, "course");

  // Parse XML to JavaScript object
  const parser = createXMLParser(["module"]);
  const courseStructure = parser.parse(xmlText);

  onProgress?.("modules-complete", `Generated ${courseStructure.course.module.length} modules`, {
    moduleCount: courseStructure.course.module.length,
  });

  return courseStructure;
}

/**
 * Generate a complete course with modules and lessons
 */
export async function createCourse({
  content,
  apiKey,
  validateStructure = true,
  validateContent = true,
  retryFailures = true,
  maxRetries = 3,
  onProgress,
}: CreateCourseInput): Promise<CourseOutput> {
  // Generate course modules
  const courseStructure = await createModules({ content, apiKey, onProgress });

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

  return {
    title: courseStructure.course.title,
    modules: allLessons,
  };
}
