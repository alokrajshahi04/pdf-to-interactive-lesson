#!/usr/bin/env tsx
/**
 * Benchmark script for comparing XML vs structured output lesson generation.
 *
 * Usage:
 *   TOGETHER_API_KEY=... tsx scripts/benchmark-structured-output.ts [--tag baseline|structured]
 *
 * Runs createCourse() against pre-extracted .md files and records:
 *   - Total generation time (ms)
 *   - Per-module and per-lesson timing
 *   - First-pass success rate (lessons passing without fixes)
 *   - Final success rate (after fix attempts)
 *   - Lesson details (title, questionType, success, wasFixed, fixAttempts)
 */

import { createCourse } from "../lib/create-course";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");
const BENCHMARKS_DIR = resolve(DATA_DIR, "benchmarks");

// Parse CLI args
const args = process.argv.slice(2);
const tag = args.find((a) => a.startsWith("--tag="))?.split("=")[1] ?? "baseline";
const mdFiles = args.filter((a) => !a.startsWith("--"));

// Resolve input files
const inputFiles =
  mdFiles.length > 0
    ? mdFiles.map((f) => resolve(f))
    : [
        resolve(DATA_DIR, "Claude Code Best Practices _ Anthropic.md"),
        resolve(DATA_DIR, "1706.03762v7.md"),
      ];

const apiKey = process.env.TOGETHER_API_KEY;
if (!apiKey) {
  console.error("TOGETHER_API_KEY is required");
  process.exit(1);
}

interface LessonMetric {
  title: string;
  questionType: string;
  success: boolean;
  wasFixed: boolean;
  fixAttempts: number;
}

interface ModuleMetric {
  title: string;
  lessons: LessonMetric[];
}

interface RunResult {
  file: string;
  contentLength: number;
  timeMs: number;
  modules: ModuleMetric[];
  totalLessons: number;
  firstPassSuccess: number;
  finalSuccess: number;
  finalFailed: number;
}

async function benchmarkFile(filePath: string): Promise<RunResult> {
  const content = readFileSync(filePath, "utf-8");
  const fileName = basename(filePath, ".md");

  console.log(`\n📄 ${fileName} (${content.length} chars)`);
  console.log("─".repeat(50));

  const start = Date.now();

  const course = await createCourse({
    content,
    apiKey: apiKey!,
    validateStructure: true,
    validateContent: true,
    retryFailures: true,
    maxRetries: 3,
  });

  const timeMs = Date.now() - start;

  // Collect metrics
  const modules: ModuleMetric[] = course.modules.map((mod) => ({
    title: mod.title,
    lessons: mod.lessons.map((lr) => {
      const wasFixed = lr.success && lr.data?.fixHistory && lr.data.fixHistory.length > 0;
      return {
        title: lr.success ? lr.data.title : lr.data?.title ?? "unknown",
        questionType: lr.success ? lr.data.questionType : lr.data?.questionType ?? "unknown",
        success: lr.success,
        wasFixed: !!wasFixed,
        fixAttempts: lr.success
          ? lr.data?.fixHistory?.length ?? 0
          : (lr as any).error?.attempts ?? 0,
      };
    }),
  }));

  const allLessons = modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const finalSuccess = allLessons.filter((l) => l.success).length;
  const firstPassSuccess = allLessons.filter((l) => l.success && !l.wasFixed).length;
  const finalFailed = totalLessons - finalSuccess;

  // Print summary
  console.log(`  ⏱  Time: ${(timeMs / 1000).toFixed(1)}s`);
  console.log(`  📊 Lessons: ${totalLessons} total`);
  console.log(`  ✅ First-pass: ${firstPassSuccess}/${totalLessons} (${Math.round((firstPassSuccess / totalLessons) * 100)}%)`);
  console.log(`  ✅ Final:      ${finalSuccess}/${totalLessons} (${Math.round((finalSuccess / totalLessons) * 100)}%)`);
  console.log(`  ❌ Failed:     ${finalFailed}`);

  modules.forEach((mod) => {
    console.log(`\n  Module: "${mod.title}"`);
    mod.lessons.forEach((l) => {
      const status = l.success ? (l.wasFixed ? "🔧" : "✅") : "❌";
      const fixInfo = l.fixAttempts > 0 ? ` (${l.fixAttempts} fix attempt${l.fixAttempts > 1 ? "s" : ""})` : "";
      console.log(`    ${status} ${l.questionType.padEnd(16)} "${l.title}"${fixInfo}`);
    });
  });

  return {
    file: fileName,
    contentLength: content.length,
    timeMs,
    modules,
    totalLessons,
    firstPassSuccess,
    finalSuccess,
    finalFailed,
  };
}

async function main() {
  console.log(`\n🏁 Benchmark: ${tag}`);
  console.log(`   Model: openai/gpt-oss-120b`);
  console.log(`   Files: ${inputFiles.map((f) => basename(f)).join(", ")}`);

  const results: RunResult[] = [];

  for (const file of inputFiles) {
    if (!existsSync(file)) {
      console.error(`File not found: ${file}`);
      continue;
    }
    const result = await benchmarkFile(file);
    results.push(result);
  }

  // Aggregate
  const totalTime = results.reduce((s, r) => s + r.timeMs, 0);
  const totalLessons = results.reduce((s, r) => s + r.totalLessons, 0);
  const totalFirstPass = results.reduce((s, r) => s + r.firstPassSuccess, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalSuccess, 0);
  const totalFailed = results.reduce((s, r) => s + r.finalFailed, 0);

  console.log("\n" + "═".repeat(50));
  console.log("AGGREGATE RESULTS");
  console.log("═".repeat(50));
  console.log(`  ⏱  Total time:       ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`  📊 Total lessons:     ${totalLessons}`);
  console.log(`  ✅ First-pass rate:   ${totalFirstPass}/${totalLessons} (${Math.round((totalFirstPass / totalLessons) * 100)}%)`);
  console.log(`  ✅ Final success:     ${totalFinal}/${totalLessons} (${Math.round((totalFinal / totalLessons) * 100)}%)`);
  console.log(`  ❌ Final failures:    ${totalFailed}`);

  // Save results
  if (!existsSync(BENCHMARKS_DIR)) {
    mkdirSync(BENCHMARKS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const outputPath = resolve(BENCHMARKS_DIR, `${tag}-${timestamp}.json`);

  const output = {
    tag,
    model: "openai/gpt-oss-120b",
    timestamp: new Date().toISOString(),
    aggregate: {
      totalTimeMs: totalTime,
      totalLessons,
      firstPassSuccess: totalFirstPass,
      firstPassRate: Math.round((totalFirstPass / totalLessons) * 100),
      finalSuccess: totalFinal,
      finalRate: Math.round((totalFinal / totalLessons) * 100),
      finalFailed: totalFailed,
    },
    results,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
