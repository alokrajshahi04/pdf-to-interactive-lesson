import { generateText } from "ai";
import type { CourseStructure, ModuleWithLessons } from "./types";
import { extractXml, createXMLParser } from "./utils/xml";
import { createLessons } from "./create-lesson";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";

export interface CreateModulesInput {
  content: string;
  apiKey: string;
}

export interface CreateCourseInput {
  content: string;
  apiKey: string;
  validateStructure?: boolean;
  validateContent?: boolean;
  retryFailures?: boolean;
  maxRetries?: number;
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
}: CreateModulesInput): Promise<CourseStructure> {
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
}: CreateCourseInput): Promise<CourseOutput> {
  // Generate course modules
  const courseStructure = await createModules({ content, apiKey });

  // Generate lessons for all modules in parallel
  const lessonsPromises = courseStructure.course.module.map((module) =>
    createLessons({
      module,
      content,
      apiKey,
      validateStructure,
      validateContent,
      retryFailures,
      maxRetries,
    })
  );

  const allLessons = await Promise.all(lessonsPromises);

  return {
    title: courseStructure.course.title,
    modules: allLessons,
  };
}
