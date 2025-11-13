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
  console.log("🤖 Requesting LLM to generate course structure...");
  const together = createTogetherClient(apiKey);
  const generationStartTime = Date.now();
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

  const generationTime = ((Date.now() - generationStartTime) / 1000).toFixed(2);
  console.log(`✅ LLM response received in ${generationTime}s`);

  // Extract XML in case there's extra text
  console.log("🔍 Parsing course structure XML...");
  const xmlText = extractXml(result.text, "course");

  // Parse XML to JavaScript object
  const parser = createXMLParser(["module"]);
  const courseStructure = parser.parse(xmlText);
  
  console.log(`✅ Parsed course structure:`);
  console.log(`   Title: "${courseStructure.course.title}"`);
  courseStructure.course.module.forEach((module: any, index: number) => {
    console.log(`   Module ${index + 1}: "${module.title}"`);
  });

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
  console.log("\n" + "=".repeat(60));
  console.log("📚 COURSE GENERATION STARTED");
  console.log("=".repeat(60));
  
  // Generate course modules
  console.log("\n📋 Step 1: Generating course structure...");
  const modulesStartTime = Date.now();
  const courseStructure = await createModules({ content, apiKey, onProgress });
  const modulesTime = ((Date.now() - modulesStartTime) / 1000).toFixed(2);
  console.log(`✅ Course structure generated in ${modulesTime}s`);
  console.log(`   Title: "${courseStructure.course.title}"`);
  console.log(`   Modules: ${courseStructure.course.module.length}`);

  const totalModules = courseStructure.course.module.length;
  console.log(`\n📚 Step 2: Generating lessons for ${totalModules} module(s)...`);
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

  const lessonsStartTime = Date.now();
  const allLessons = await Promise.all(lessonsPromises);
  const lessonsTime = ((Date.now() - lessonsStartTime) / 1000).toFixed(2);
  
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
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 COURSE GENERATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`⏱️  Lessons generation time: ${lessonsTime}s`);
  console.log(`📚 Total modules: ${totalModules}`);
  console.log(`📝 Total lessons: ${totalLessons}`);
  console.log(`✅ Successful lessons: ${successfulLessons} (${Math.round((successfulLessons / totalLessons) * 100)}%)`);
  if (failedLessons > 0) {
    console.log(`❌ Failed lessons: ${failedLessons}`);
  }
  console.log("=".repeat(60) + "\n");

  return {
    title: courseStructure.course.title,
    modules: allLessons,
  };
}
