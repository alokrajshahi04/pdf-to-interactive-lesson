#!/usr/bin/env npx tsx

import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import axios from "axios";
import ora from "ora";
import { ocr } from "../lib/ocr";
import { createModules, createCourse } from "../lib/create-course";
import { generateSlug } from "../lib/utils/slug";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../lib/utils/together";

const VERSION = "1.0.0";

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Suppress library noise by default (re-enabled with --verbose)
let verboseMode = false;
const suppressPatterns = [/^  ❌/, /^     /, /^  ⚠️/, /^\s+Reason:/, /^\s+- \[/, /^\s+Details:/];

function shouldSuppress(args: any[]): boolean {
  if (verboseMode) return false;
  const msg = args[0];
  if (typeof msg !== "string") return false;
  return suppressPatterns.some((p) => p.test(msg));
}

console.warn = (...args: any[]) => {
  if (!shouldSuppress(args)) originalConsole.warn(...args);
};
console.error = (...args: any[]) => {
  if (!shouldSuppress(args)) originalConsole.error(...args);
};

// ANSI colors
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

interface CliArgs {
  command: string;
  file?: string;
  model: string;
  validateStructure: boolean;
  validateContent: boolean;
  retryFailures: boolean;
  maxRetries: number;
  runs: number;
  output?: string;
  saveText?: string;
  saveTextAuto: boolean;
  verbose: boolean;
}

function printBanner() {
  console.log(`
${cyan("╔══════════════════════════════════════════════════════════════╗")}
${cyan("║")}  ${bold("📚 Course Generator CLI")}                      ${dim(`v${VERSION}`)}    ${cyan("║")}
${cyan("║")}  ${dim("Transform PDFs into interactive lessons")}                   ${cyan("║")}
${cyan("╚══════════════════════════════════════════════════════════════╝")}
`);
}

function printHelp() {
  printBanner();
  console.log(`${bold("USAGE")}
  ${cyan("course")} ${yellow("<command>")} ${dim("[file]")} ${dim("[options]")}

${bold("COMMANDS")}
  ${yellow("generate")} ${dim("<file>")}     Generate a complete course from PDF/markdown
  ${yellow("modules")} ${dim("<file>")}      Generate only course structure (no lessons)
  ${yellow("help")}               Show this help message
  ${yellow("version")}            Show version number

${bold("OPTIONS")}
  ${dim("-m")}, ${dim("--model")} ${cyan("<name>")}   Model to use for generation
                       ${dim(`Models: ${Object.keys(AVAILABLE_MODELS).join(", ")}`)}
                       ${dim(`Default: deepseek`)}
  
  ${dim("--output")} ${cyan("<path>")}       Save output to specific path
                       ${dim("Default: data/{slug}-{timestamp}.json")}
  
  ${dim("--save-text")} ${cyan("<path>")}    Save extracted text to file (PDFs only)
  ${dim("--save-text-auto")}       Save text next to PDF as .md file
  
  ${dim("--no-validate")}          Skip all validation
  ${dim("--no-validate-structure")} Skip structure validation
  ${dim("--no-validate-content")}   Skip content validation
  
  ${dim("--no-retry")}             Don't auto-fix failed lessons
  ${dim("--max-retries")} ${cyan("<n>")}     Max retry attempts ${dim("(default: 3)")}
  ${dim("--runs")} ${cyan("<n>")}            Run generation n times ${dim("(for testing)")}
  ${dim("--verbose")}              Show detailed validation errors

${bold("EXAMPLES")}
  ${dim("# Generate course from PDF")}
  ${cyan("course generate")} data/document.pdf

  ${dim("# Use a different model")}
  ${cyan("course generate")} data/document.pdf ${dim("-m llama-70b")}

  ${dim("# Generate and cache OCR text")}
  ${cyan("course generate")} data/document.pdf --save-text-auto

  ${dim("# Generate from cached text (faster)")}
  ${cyan("course generate")} data/document.md

  ${dim("# Generate with custom output path")}
  ${cyan("course generate")} data/document.pdf --output my-course.json

  ${dim("# Quick generation (skip validation)")}
  ${cyan("course generate")} data/document.pdf --no-validate

  ${dim("# Only generate course structure")}
  ${cyan("course modules")} data/document.pdf

${bold("ENVIRONMENT")}
  ${cyan("TOGETHER_API_KEY")}  Required. Your Together AI API key.
`);
}

function printVersion() {
  console.log(`course-cli v${VERSION}`);
}

// Download file from URL
async function downloadFile(url: string): Promise<string> {
  const tempPath = `./output/temp-${Date.now()}.pdf`;
  const spinner = ora("Downloading PDF from URL").start();

  try {
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

    spinner.succeed(`Downloaded to ${dim(tempPath)}`);
    return tempPath;
  } catch (error) {
    spinner.fail("Failed to download file");
    throw error;
  }
}

function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  // Handle no args or help
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  // Handle version
  if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") {
    printVersion();
    process.exit(0);
  }

  const command = args[0];
  const validCommands = ["generate", "modules", "gen", "mod"];

  if (!validCommands.includes(command)) {
    console.error(`\n${red("✗")} Unknown command: ${command}\n`);
    console.log(`Run ${cyan("course help")} for usage information.\n`);
    process.exit(1);
  }

  // Normalize aliases
  const normalizedCommand = command === "gen" ? "generate" : command === "mod" ? "modules" : command;

  // File is required for generate/modules
  const file = args[1];
  if (!file || file.startsWith("--")) {
    console.error(`\n${red("✗")} Missing file argument\n`);
    console.log(`Usage: ${cyan(`course ${normalizedCommand}`)} ${yellow("<file>")} ${dim("[options]")}\n`);
    process.exit(1);
  }

  let model = DEFAULT_MODEL;
  let validateStructure = true;
  let validateContent = true;
  let retryFailures = true;
  let maxRetries = 3;
  let runs = 1;
  let output: string | undefined;
  let saveText: string | undefined;
  let saveTextAuto = false;
  let verbose = false;

  // Parse flags
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-m" || arg === "--model") {
      const modelArg = args[++i];
      if (modelArg in AVAILABLE_MODELS) {
        model = AVAILABLE_MODELS[modelArg as keyof typeof AVAILABLE_MODELS];
      } else if (modelArg?.includes("/")) {
        // Allow full model names like "meta-llama/Llama-3.3-70B-Instruct-Turbo"
        model = modelArg;
      } else {
        console.error(`\n${red("✗")} Unknown model: ${modelArg}\n`);
        console.log(`Available models: ${Object.keys(AVAILABLE_MODELS).join(", ")}\n`);
        process.exit(1);
      }
    } else if (arg === "--no-validate") {
      validateStructure = false;
      validateContent = false;
    } else if (arg === "--no-validate-structure") {
      validateStructure = false;
    } else if (arg === "--no-validate-content") {
      validateContent = false;
    } else if (arg === "--no-retry") {
      retryFailures = false;
    } else if (arg === "--max-retries" && args[i + 1]) {
      maxRetries = parseInt(args[++i], 10);
    } else if (arg === "--runs" && args[i + 1]) {
      runs = parseInt(args[++i], 10);
    } else if (arg === "--output" && args[i + 1]) {
      output = args[++i];
    } else if (arg === "--save-text" && args[i + 1]) {
      saveText = args[++i];
    } else if (arg === "--save-text-auto") {
      saveTextAuto = true;
    } else if (arg === "--verbose") {
      verbose = true;
    }
  }

  return {
    command: normalizedCommand,
    file,
    model,
    validateStructure,
    validateContent,
    retryFailures,
    maxRetries,
    runs,
    output,
    saveText,
    saveTextAuto,
    verbose,
  };
}

async function extractContent(filePath: string, saveTextPath?: string): Promise<string> {
  if (filePath.endsWith(".pdf")) {
    const spinner = ora("Running OCR on PDF").start();
    const startTime = Date.now();

    try {
      const result = await ocr(filePath, {
        maintainFormat: false,
        concurrency: 5,
        apiKey: process.env.TOGETHER_API_KEY || "",
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const content = result.pages.map((p) => p.content).join("\n\n");

      spinner.succeed(
        `OCR complete ${dim(`${result.pages.length} pages, ${elapsed}s`)}`
      );

      if (saveTextPath) {
        await writeFile(saveTextPath, content, "utf-8");
        console.log(`  ${dim("└─")} Saved to ${cyan(saveTextPath)}`);
      }

      return content;
    } catch (error) {
      spinner.fail("OCR failed");
      throw error;
    }
  } else if (filePath.endsWith(".md") || filePath.endsWith(".txt")) {
    const spinner = ora("Reading text file").start();
    const content = await readFile(filePath, "utf-8");
    spinner.succeed(`Loaded ${dim(`${content.length.toLocaleString()} chars`)}`);
    return content;
  } else {
    throw new Error("File must be .pdf, .md, or .txt");
  }
}

async function runGenerateModules(content: string, args: CliArgs) {
  const spinner = ora("Generating course modules").start();
  const startTime = Date.now();

  try {
    const courseStructure = await createModules({
      content,
      apiKey: process.env.TOGETHER_API_KEY || "",
      model: args.model,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const moduleCount = courseStructure.course.module.length;
    spinner.succeed(`Generated ${moduleCount} modules ${dim(`${elapsed}s`)}`);

    displayModules(courseStructure);

    return {
      title: courseStructure.course.title,
      modules: courseStructure.course.module,
    };
  } catch (error) {
    spinner.fail("Failed to generate modules");
    throw error;
  }
}

async function runGenerateCourse(content: string, args: CliArgs) {
  const spinner = ora("Generating course structure").start();
  const startTime = Date.now();

  try {
    // Update spinner text as we progress
    const course = await createCourse({
      content,
      apiKey: process.env.TOGETHER_API_KEY || "",
      model: args.model,
      validateStructure: args.validateStructure,
      validateContent: args.validateContent,
      retryFailures: args.retryFailures,
      maxRetries: args.maxRetries,
      onProgress: (type: string, message: string) => {
        spinner.text = message;
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const lessonCount = course.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);
    spinner.succeed(`Generated ${course.modules.length} modules, ${lessonCount} lessons ${dim(`${elapsed}s`)}`);

    displaySummary(course, args);
    displayCourse(course);

    return course;
  } catch (error) {
    spinner.fail("Course generation failed");
    throw error;
  }
}

async function runMultipleTimes(content: string, args: CliArgs) {
  console.log(`\n${yellow("🔁")} Running generation ${args.runs} times...\n`);
  console.log("═".repeat(60));

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
    const spinner = ora(`Run ${run}/${args.runs}`).start();
    const runStart = Date.now();

    try {
      let result: any;

      if (args.command === "modules") {
        spinner.text = `Run ${run}/${args.runs}: Generating modules`;
        result = await createModules({
          content,
          apiKey: process.env.TOGETHER_API_KEY || "",
          model: args.model,
        });
        result = { title: result.course.title, modules: result.course.module };
      } else {
        spinner.text = `Run ${run}/${args.runs}: Generating course`;
        result = await createCourse({
          content,
          apiKey: process.env.TOGETHER_API_KEY || "",
          model: args.model,
          validateStructure: args.validateStructure,
          validateContent: args.validateContent,
          retryFailures: args.retryFailures,
          maxRetries: args.maxRetries,
        });
      }

      const runTime = (Date.now() - runStart) / 1000;

      if (result.modules) {
        const lessons = result.modules.flatMap((m: any) => m.lessons || []);
        const failed = lessons.filter((l: any) => l.success === false).length;
        const fixed = lessons.filter((l: any) => l.success === true && l.data?.fixHistory).length;

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

        spinner.succeed(
          `Run ${run}: ${lessons.length - failed}/${lessons.length} lessons ${dim(`${runTime.toFixed(1)}s`)}`
        );
      } else {
        spinner.succeed(`Run ${run} complete ${dim(`${runTime.toFixed(1)}s`)}`);
      }

      lastResult = result;
    } catch (error) {
      spinner.fail(`Run ${run} failed`);
      stats.runDetails.push({
        run,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Display stats
  console.log("\n" + dim("─".repeat(50)));
  console.log(`${bold("Stats")} ${dim(`(${stats.runs} runs)`)}`);
  console.log(`  ${dim("Total lessons:")} ${stats.totalLessons}`);
  console.log(`  ${dim("Avg per run:")} ${(stats.totalLessons / stats.runs).toFixed(1)}`);
  if (stats.totalLessons > 0) {
    console.log(`  ${dim("Failed:")} ${stats.totalFailed} (${((stats.totalFailed / stats.totalLessons) * 100).toFixed(1)}%)`);
    console.log(`  ${dim("Fixed:")} ${stats.totalFixed} (${((stats.totalFixed / stats.totalLessons) * 100).toFixed(1)}%)`);
  }
  console.log(`  ${dim("Avg time:")} ${(stats.totalTime / stats.runs).toFixed(2)}s`);

  return { ...lastResult, testStats: stats };
}

function displayModules(courseStructure: any) {
  console.log("\n" + dim("─".repeat(50)));
  console.log(`${bold("Course")}: ${courseStructure.course.title}\n`);

  courseStructure.course.module.forEach((module: any, i: number) => {
    console.log(`${cyan(`${i + 1}.`)} ${module.title}`);
  });
  console.log("");
}

function displaySummary(course: { modules: any[] }, args: CliArgs) {
  let total = 0,
    successful = 0,
    fixed = 0,
    failed = 0,
    fixAttempts = 0;

  for (const module of course.modules) {
    for (const lessonResult of module.lessons) {
      total++;
      if (lessonResult.success) {
        successful++;
        if (lessonResult.data.fixHistory?.length > 0) {
          fixed++;
          fixAttempts += lessonResult.data.fixHistory.length;
        }
      } else {
        failed++;
        if (lessonResult.error?.fixHistory) {
          fixAttempts += lessonResult.error.fixHistory.length;
        }
      }
    }
  }

  console.log("\n" + dim("─".repeat(50)));
  console.log(`${bold("Summary")}`);
  console.log(`  ${dim("Modules:")} ${course.modules.length}`);
  console.log(`  ${dim("Lessons:")} ${total}`);
  console.log(`  ${green("✓")} Successful: ${successful} (${Math.round((successful / total) * 100)}%)`);
  if (fixed > 0) console.log(`  ${yellow("🔧")} Fixed: ${fixed}`);
  if (failed > 0) console.log(`  ${red("✗")} Failed: ${failed}`);
  if (fixAttempts > 0) console.log(`  ${dim("Fix attempts:")} ${fixAttempts}`);
}

function displayCourse(course: { title: string; modules: any[] }) {
  console.log("\n" + dim("─".repeat(50)));
  console.log(`${bold("Course")}: ${course.title}\n`);

  for (let i = 0; i < course.modules.length; i++) {
    const mod = course.modules[i];
    console.log(`${cyan(`${i + 1}.`)} ${mod.title}`);

    for (const lesson of mod.lessons) {
      if (lesson.success) {
        const fixInfo = lesson.data.fixHistory ? ` ${yellow("🔧")}` : "";
        console.log(`   ${green("✓")} ${lesson.data.title} ${dim(`[${lesson.data.questionType}]`)}${fixInfo}`);
      } else {
        console.log(`   ${red("✗")} ${lesson.data?.title || "Unknown"} ${dim(`[${lesson.error?.validationType}]`)}`);
      }
    }
    console.log("");
  }
}

async function main() {
  const args = parseArgs();

  // Enable verbose output if requested
  if (args.verbose) {
    verboseMode = true;
  }

  // Check for API key
  if (!process.env.TOGETHER_API_KEY) {
    console.error(`\n${red("✗")} Missing ${cyan("TOGETHER_API_KEY")} environment variable\n`);
    console.log(`Set it in your ${cyan(".env.local")} file or export it:\n`);
    console.log(`  ${dim("export TOGETHER_API_KEY=your-api-key")}\n`);
    process.exit(1);
  }

  let filePath = args.file!;
  let isTemp = false;

  try {
    // Download if URL
    if (isUrl(filePath)) {
      filePath = await downloadFile(filePath);
      isTemp = true;
    } else if (!existsSync(filePath)) {
      console.error(`\n${red("✗")} File not found: ${filePath}\n`);
      process.exit(1);
    }

    // Get model alias for display
    const modelAlias = Object.entries(AVAILABLE_MODELS).find(([_, v]) => v === args.model)?.[0] || args.model;
    
    console.log(`\n${dim("File:")} ${cyan(filePath)}`);
    console.log(`${dim("Model:")} ${cyan(modelAlias)}`);
    console.log(`${dim("Mode:")} ${args.command === "modules" ? "modules only" : "full course"}`);
    if (args.command !== "modules") {
      console.log(`${dim("Validation:")} ${args.validateStructure || args.validateContent ? "enabled" : "disabled"}`);
    }
    console.log("");

    // Determine save text path
    let saveTextPath: string | undefined;
    if (filePath.endsWith(".pdf")) {
      if (args.saveText) {
        saveTextPath = args.saveText;
      } else if (args.saveTextAuto) {
        saveTextPath = filePath.replace(".pdf", ".md");
      }
    }

    // Extract content
    const content = await extractContent(filePath, saveTextPath);

    // Execute command
    let result: any;

    if (args.runs > 1) {
      result = await runMultipleTimes(content, args);
    } else if (args.command === "modules") {
      result = await runGenerateModules(content, args);
    } else {
      result = await runGenerateCourse(content, args);
    }

    // Save output
    const saveSpinner = ora("Saving output").start();
    let outputPath = args.output;
    if (!outputPath) {
      const courseTitle = result.title || "course";
      const slug = generateSlug(courseTitle, Date.now().toString());
      const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      outputPath = join("data", `${slug}-${isoTimestamp}.json`);
      await mkdir("data", { recursive: true });
    }

    await writeFile(outputPath, JSON.stringify(result, null, 2));
    saveSpinner.succeed(`Saved to ${cyan(outputPath)}`);

    // Cleanup
    if (isTemp) {
      await unlink(filePath);
    }

    console.log("");
  } catch (error) {
    console.error(`\n${red("✗")} Error:`, error);
    if (isTemp && existsSync(filePath)) {
      await unlink(filePath);
    }
    process.exit(1);
  }
}

main();
