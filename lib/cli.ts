import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import axios from "axios";
import { ocr } from "./ocr";
import { createModules, createCourse } from "./create-course";

/**
 * CLI for generating course modules and lessons from PDFs or markdown
 *
 * Usage:
 *   pnpm tsx lib/cli.ts <command> <file> [options]
 *
 * Commands:
 *   generate-course    Generate full course with modules and lessons
 *   generate-modules   Generate only course modules (no lessons)
 *   generate-lessons   Generate lessons for specific module
 *
 * Options:
 *   --no-validate              Disable all validation
 *   --no-validate-structure    Disable structure validation only
 *   --no-validate-content      Disable content validation only
 *   --no-retry                 Disable automatic retry/fix of failed lessons
 *   --max-retries <num>        Maximum retry attempts (default: 3)
 *   --runs <num>               Number of times to run generation (for testing, default: 1)
 *   --output <path>            Save output to JSON file (default: lessons.json)
 *
 * Examples:
 *   pnpm tsx lib/cli.ts generate-course data/document.pdf
 *   pnpm tsx lib/cli.ts generate-course data/document.pdf --no-validate
 *   pnpm tsx lib/cli.ts generate-course data/document.pdf --no-retry
 *   pnpm tsx lib/cli.ts generate-course data/document.pdf --max-retries 5
 *   pnpm tsx lib/cli.ts generate-course data/document.pdf --runs 10
 *   pnpm tsx lib/cli.ts generate-modules https://example.com/doc.pdf
 *   pnpm tsx lib/cli.ts generate-course output/document.md --output course.json
 *
 * Note: Output is automatically saved to lessons.json (or specified path)
 */

interface CliArgs {
  command: "generate-course" | "generate-modules" | "generate-lessons";
  file: string;
  validateStructure: boolean;
  validateContent: boolean;
  retryFailures: boolean;
  maxRetries: number;
  runs: number; // Number of times to run generation (for testing)
  output?: string;
}

// Download file from URL to temp location
async function downloadFile(url: string): Promise<string> {
  const tempPath = `./output/temp-${Date.now()}.pdf`;
  console.log(`📥 Downloading from URL...`);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });

  const writer = require("fs").createWriteStream(tempPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`✅ Downloaded to ${tempPath}\n`);
  return tempPath;
}

// Check if input is a URL
function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

// Parse CLI arguments
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const command = args[0] as CliArgs["command"];
  const validCommands: CliArgs["command"][] = [
    "generate-course",
    "generate-modules",
    "generate-lessons",
  ];

  if (!validCommands.includes(command)) {
    console.error(`❌ Invalid command: ${command}`);
    printUsage();
    process.exit(1);
  }

  const file = args[1];
  let validateStructure = true; // Default: ON
  let validateContent = true; // Default: ON
  let retryFailures = true; // Default: ON
  let maxRetries = 3; // Default: 3
  let runs = 1; // Default: 1
  let output: string | undefined;

  // Parse flags
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--no-validate") {
      validateStructure = false;
      validateContent = false;
    } else if (args[i] === "--no-validate-structure") {
      validateStructure = false;
    } else if (args[i] === "--no-validate-content") {
      validateContent = false;
    } else if (args[i] === "--no-retry") {
      retryFailures = false;
    } else if (args[i] === "--max-retries") {
      maxRetries = parseInt(args[i + 1], 10);
      i++; // Skip next arg
    } else if (args[i] === "--runs") {
      runs = parseInt(args[i + 1], 10);
      i++; // Skip next arg
    } else if (args[i] === "--output") {
      output = args[i + 1];
      i++; // Skip next arg
    }
  }

  return {
    command,
    file,
    validateStructure,
    validateContent,
    retryFailures,
    maxRetries,
    runs,
    output,
  };
}

// Print usage information
function printUsage() {
  console.error(`
Usage: pnpm tsx lib/cli.ts <command> <file> [options]

Commands:
  generate-course    Generate full course with modules and lessons
  generate-modules   Generate only course modules (no lessons)
  generate-lessons   Generate lessons for specific module

Options:
  --no-validate              Disable all validation
  --no-validate-structure    Disable structure validation only
  --no-validate-content      Disable content validation only (saves time/cost)
  --no-retry                 Disable automatic retry/fix of failed lessons
  --max-retries <num>        Maximum retry attempts (default: 3)
  --runs <num>               Number of times to run generation (for testing, default: 1)
  --output <path>            Save output to JSON file (default: lessons.json)

Notes:
  - Validation and retry are ENABLED by default
  - Failed lessons are automatically retried up to 3 times
  - Output is automatically saved to lessons.json (or specified path)
  - Use --runs for testing reliability and collecting error statistics

Examples:
  pnpm tsx lib/cli.ts generate-course data/document.pdf
  pnpm tsx lib/cli.ts generate-course data/document.pdf --no-validate
  pnpm tsx lib/cli.ts generate-course data/document.pdf --no-retry
  pnpm tsx lib/cli.ts generate-course data/document.pdf --max-retries 5
  pnpm tsx lib/cli.ts generate-course data/document.pdf --runs 10
  pnpm tsx lib/cli.ts generate-modules https://example.com/doc.pdf
  pnpm tsx lib/cli.ts generate-course output/document.md --output course.json
`);
}

// Extract text content from PDF or markdown
async function extractContent(filePath: string): Promise<string> {
  if (filePath.endsWith(".pdf")) {
    console.log("🔍 Running OCR on PDF...");
    const startTime = Date.now();

    const result = await ocr(filePath, {
      maintainFormat: false,
      concurrency: 5,
      apiKey: process.env.TOGETHER_API_KEY || "",
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ OCR completed in ${elapsed}s`);
    console.log(`   Pages: ${result.pages.length}`);
    console.log(
      `   Tokens: ${result.inputTokens.toLocaleString()} in / ${result.outputTokens.toLocaleString()} out\n`
    );

    return result.pages.map((p) => p.content).join("\n\n");
  } else if (filePath.endsWith(".md")) {
    console.log("📖 Reading markdown file...");
    const content = await readFile(filePath, "utf-8");
    console.log(`✅ Loaded ${content.length} characters\n`);
    return content;
  } else {
    throw new Error("File must be .pdf or .md");
  }
}

async function main() {
  if (!process.env.TOGETHER_API_KEY) {
    console.error("❌ TOGETHER_API_KEY environment variable not set");
    process.exit(1);
  }

  const args = parseArgs();
  let filePath = args.file;
  let isTemp = false;

  try {
    // Download if URL
    if (isUrl(args.file)) {
      filePath = await downloadFile(args.file);
      isTemp = true;
    } else if (!existsSync(args.file)) {
      console.error(`❌ File not found: ${args.file}`);
      process.exit(1);
    }

    console.log(`📄 Processing: ${filePath}`);
    console.log(`🔍 Validation:`);
    console.log(
      `   Structure: ${args.validateStructure ? "✅ ENABLED" : "❌ DISABLED"}`
    );
    console.log(
      `   Content:   ${args.validateContent ? "✅ ENABLED" : "❌ DISABLED"}\n`
    );

    // Extract content
    const content = await extractContent(filePath);

    // Execute command (single or multiple runs)
    let result: any;

    if (args.runs > 1) {
      result = await runMultipleTimes(content, args);
    } else {
      if (args.command === "generate-modules") {
        result = await runGenerateModules(content);
      } else if (args.command === "generate-course") {
        result = await runGenerateCourse(content, args);
      } else if (args.command === "generate-lessons") {
        console.error(
          "❌ generate-lessons command not yet implemented. Use generate-course instead."
        );
        process.exit(1);
      }
    }

    // Save to file if output path provided, or default to lessons.json
    const outputPath = args.output || "lessons.json";
    await writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Output saved to: ${outputPath}`);

    // Cleanup temp file
    if (isTemp) {
      await unlink(filePath);
      console.log("\n🧹 Cleaned up temporary file");
    }
  } catch (error) {
    console.error("\n❌ Error:", error);

    // Cleanup temp file on error
    if (isTemp && existsSync(filePath)) {
      await unlink(filePath);
    }

    process.exit(1);
  }
}

/**
 * Run generation multiple times and collect statistics (for testing)
 */
async function runMultipleTimes(content: string, args: CliArgs) {
  console.log(`\n🔁 Running generation ${args.runs} times...\n`);
  console.log("=".repeat(60));

  const stats = {
    runs: args.runs,
    totalLessons: 0,
    totalFailed: 0,
    totalFixed: 0,
    totalTime: 0,
    runDetails: [] as any[],
  };

  let lastResult: any;

  for (let run = 1; run <= args.runs; run++) {
    console.log(`\n🏃 Run ${run}/${args.runs}`);
    console.log("-".repeat(60));

    const runStart = Date.now();

    try {
      let result: any;

      if (args.command === "generate-modules") {
        result = await runGenerateModules(content);
      } else if (args.command === "generate-course") {
        result = await runGenerateCourse(content, args);
      }

      const runTime = (Date.now() - runStart) / 1000;

      // Collect statistics
      if (result.modules) {
        const lessons = result.modules.flatMap((m: any) => m.lessons);
        const failed = lessons.filter((l: any) => l.success === false).length;
        const fixed = lessons.filter(
          (l: any) => l.success === true && l.data.fixHistory
        ).length;

        stats.totalLessons += lessons.length;
        stats.totalFailed += failed;
        stats.totalFixed += fixed;
        stats.totalTime += runTime;

        stats.runDetails.push({
          run,
          lessons: lessons.length,
          successful: lessons.length - failed,
          failed,
          fixed,
          time: runTime,
        });

        console.log(
          `   ✅ ${lessons.length} lessons (${
            lessons.length - failed
          } successful, ${failed} failed, ${fixed} fixed) - ${runTime.toFixed(
            2
          )}s`
        );
      }

      lastResult = result;
    } catch (error) {
      console.error(`   ❌ Run ${run} failed:`, error);
      stats.runDetails.push({
        run,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Display aggregate statistics
  console.log("\n" + "=".repeat(60));
  console.log("📊 AGGREGATE STATISTICS");
  console.log("=".repeat(60));
  console.log(`\n  Total Runs: ${stats.runs}`);
  console.log(`  Total Lessons Generated: ${stats.totalLessons}`);
  console.log(
    `  Average Lessons per Run: ${(stats.totalLessons / stats.runs).toFixed(1)}`
  );
  console.log(
    `  Total Failed: ${stats.totalFailed} (${(
      (stats.totalFailed / stats.totalLessons) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `  Total Fixed: ${stats.totalFixed} (${(
      (stats.totalFixed / stats.totalLessons) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `  Average Time per Run: ${(stats.totalTime / stats.runs).toFixed(2)}s`
  );
  console.log(`  Total Time: ${stats.totalTime.toFixed(2)}s`);

  // Show per-run breakdown
  console.log(`\n  Per-Run Breakdown:`);
  stats.runDetails.forEach((detail) => {
    if (detail.error) {
      console.log(`    Run ${detail.run}: ❌ ERROR - ${detail.error}`);
    } else {
      console.log(
        `    Run ${detail.run}: ${detail.successful}✅ ${detail.failed}❌ ${
          detail.fixed
        }🔧 (${detail.time.toFixed(1)}s)`
      );
    }
  });

  console.log("\n" + "=".repeat(60));

  // Return the last successful result and stats
  return {
    ...lastResult,
    testStats: stats,
  };
}

/**
 * CLI wrapper for generating only modules (no lessons)
 */
async function runGenerateModules(content: string) {
  console.log("🤖 Generating course modules...\n");
  const startTime = Date.now();

  const courseStructure = await createModules({ content, apiKey: process.env.TOGETHER_API_KEY || "" });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Course generation completed in ${elapsed}s\n`);

  // Display results
  displayModulesOnly(courseStructure);

  return {
    title: courseStructure.course.title,
    modules: courseStructure.course.module,
  };
}

/**
 * CLI wrapper for generating a complete course with modules and lessons
 */
async function runGenerateCourse(content: string, args: CliArgs) {
  console.log("🤖 Generating course modules...\n");
  let startTime = Date.now();

  // Call the business logic from create-course.ts
  const course = await createCourse({
    content,
    validateStructure: args.validateStructure,
    validateContent: args.validateContent,
    retryFailures: args.retryFailures,
    maxRetries: args.maxRetries,
    apiKey: process.env.TOGETHER_API_KEY || "",
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Course generation completed in ${elapsed}s\n`);

  // Display validation summary
  displayValidationSummary(course, args);

  // Display full course results
  displayCourseResults(course);

  return course;
}

/**
 * Display validation summary with lesson statistics
 */
function displayValidationSummary(course: { modules: any[] }, args: CliArgs) {
  // Calculate lesson statistics
  let total = 0;
  let successful = 0;
  let fixed = 0;
  let failed = 0;
  let fixAttempts = 0;

  for (const module of course.modules) {
    for (const lessonResult of module.lessons) {
      total++;

      if (lessonResult.success) {
        successful++;
        // Check if this lesson was fixed (has fixHistory)
        if (lessonResult.data.fixHistory && lessonResult.data.fixHistory.length > 0) {
          fixed++;
          fixAttempts += lessonResult.data.fixHistory.length;
        }
      } else {
        failed++;
        // Count fix attempts from failed lessons
        if (lessonResult.error?.fixHistory) {
          fixAttempts += lessonResult.error.fixHistory.length;
        }
      }
    }
  }

  // Display summary with clean formatting
  console.log("=".repeat(60));
  console.log("✅ LESSON GENERATION SUMMARY");
  console.log("=".repeat(60));
  console.log("📚 Content:");
  console.log(`   ├─ Modules: ${course.modules.length}`);
  console.log(`   └─ Lessons: ${total}`);
  console.log("");
  console.log("📊 Results:");
  console.log(`   ├─ Successful: ${successful} (${Math.round((successful / total) * 100)}%)`);
  console.log(`   ├─ Fixed: ${fixed} (required retries)`);
  console.log(`   ├─ Failed: ${failed}`);
  console.log(`   └─ Fix Attempts: ${fixAttempts} total`);
  
  if (args.validateStructure || args.validateContent) {
    const validations = [];
    if (args.validateStructure) validations.push("structure");
    if (args.validateContent) validations.push("content");
    console.log("");
    console.log(`🔍 Validation: ${validations.join(" & ")}`);
  }
  
  console.log("=".repeat(60) + "\n");
}

/**
 * Display modules without lessons
 */
function displayModulesOnly(courseStructure: any) {
  console.log("=".repeat(60));
  console.log("📚 COURSE STRUCTURE");
  console.log("=".repeat(60));
  console.log(`\nTitle: ${courseStructure.course.title}`);
  console.log(`\nModules (${courseStructure.course.module.length}):\n`);

  courseStructure.course.module.forEach((module: any, i: number) => {
    console.log(`  ${i + 1}. ${module.title}`);
  });

  console.log("\n" + "=".repeat(60));
}

/**
 * Display complete course with lessons
 */
function displayCourseResults(course: { title: string; modules: any[] }) {
  console.log("=".repeat(60));
  console.log("📚 COURSE STRUCTURE");
  console.log("=".repeat(60));
  console.log(`\nTitle: ${course.title}`);
  console.log(`\nModules (${course.modules.length}):\n`);

  let totalLessons = 0;
  let totalFailures = 0;
  let totalFixed = 0;

  for (let i = 0; i < course.modules.length; i++) {
    const moduleWithLessons = course.modules[i];
    const allLessons = moduleWithLessons.lessons;

    totalLessons += allLessons.length;
    const failedLessons = allLessons.filter((l: any) => l.success === false);
    const successfulLessons = allLessons.filter((l: any) => l.success === true);
    totalFailures += failedLessons.length;

    // Count lessons that were fixed
    const fixedCount = successfulLessons.filter(
      (lesson: any) =>
        lesson.data.fixHistory && lesson.data.fixHistory.length > 0
    ).length;
    totalFixed += fixedCount;

    console.log(`\n  ${i + 1}. ${moduleWithLessons.title}`);
    console.log(`     Lessons (${allLessons.length} total):`);

    // Show all lessons in order with their status
    for (const lessonResult of allLessons) {
      if (lessonResult.success) {
        const lesson = lessonResult.data;
        const fixInfo = lesson.fixHistory
          ? ` 🔧 (fixed after ${lesson.fixHistory.length} attempts)`
          : "";
        console.log(
          `       ✅ ${lesson.title} [${lesson.questionType}]${fixInfo}`
        );
      } else {
        const lessonTitle = lessonResult.data?.title || "Unknown Lesson";
        const attemptsInfo = lessonResult.error.attempts
          ? ` (${lessonResult.error.attempts} fix attempts)`
          : "";
        console.log(
          `       ❌ ${lessonTitle} [${lessonResult.error.validationType}]${attemptsInfo}`
        );
        console.log(`          ${lessonResult.error.reason}`);

        // Show fix history if available
        if (
          lessonResult.error.fixHistory &&
          lessonResult.error.fixHistory.length > 0
        ) {
          console.log(`          Fix attempts:`);
          lessonResult.error.fixHistory.forEach((attempt: any) => {
            console.log(
              `            Attempt ${attempt.attempt}: ${attempt.reason}`
            );
            if (attempt.details && attempt.details.length > 0) {
              attempt.details.forEach((detail: string) => {
                console.log(
                  `              - ${detail.substring(0, 100)}${
                    detail.length > 100 ? "..." : ""
                  }`
                );
              });
            }
          });
        }

        // Show latest failure details
        if (
          lessonResult.error.details &&
          lessonResult.error.details.length > 0
        ) {
          console.log(`          Final errors:`);
          lessonResult.error.details.forEach((detail: string) => {
            console.log(`          - ${detail}`);
          });
        }
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `📊 Summary: ${totalLessons} lessons generated${
      totalFixed > 0 ? `, ${totalFixed} fixed` : ""
    }${totalFailures > 0 ? `, ${totalFailures} failed` : ""}`
  );
  console.log("=".repeat(60));
}

main();
