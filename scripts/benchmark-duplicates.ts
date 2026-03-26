#!/usr/bin/env tsx
/**
 * Benchmark duplicate questions across all PDFs.
 *
 * Runs all PDFs in data/pdfs/ in parallel, collects every question generated,
 * then reports duplicates within each course and across courses.
 *
 * Usage:
 *   TOGETHER_API_KEY=... tsx scripts/benchmark-duplicates.ts
 */

import { createCourse } from "../lib/create-course";
import { ocr } from "../lib/ocr";
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDFS_DIR = resolve(__dirname, "../data/pdfs");
const BENCHMARKS_DIR = resolve(__dirname, "../data/benchmarks");

const apiKey = process.env.TOGETHER_API_KEY;
if (!apiKey) {
  console.error("TOGETHER_API_KEY is required");
  process.exit(1);
}

interface Question {
  file: string;
  moduleTitle: string;
  moduleIndex: number;
  lessonTitle: string;
  lessonIndex: number;
  questionType: string;
  question: string;
  answer: string | boolean | number;
}

interface DuplicateGroup {
  question: string;
  occurrences: Question[];
}

interface CourseResult {
  file: string;
  questions: Question[];
  totalLessons: number;
  successfulLessons: number;
  timeMs: number;
}

async function processPdf(filePath: string): Promise<CourseResult> {
  const fileName = basename(filePath);
  console.log(`\n📄 Starting: ${fileName}`);

  const ocrStart = Date.now();
  const ocrResult = await ocr(filePath);
  const content = ocrResult.pages
    .filter((p) => p.success)
    .map((p) => p.content)
    .join("\n\n");

  console.log(`  📄 OCR done: ${ocrResult.successfulPages} pages, ${content.length} chars (${((Date.now() - ocrStart) / 1000).toFixed(1)}s)`);

  // Truncate to keep costs reasonable
  const maxChars = 20000;
  const truncated =
    content.length > maxChars
      ? content.substring(0, maxChars) + "\n\n[Content truncated]"
      : content;

  const courseStart = Date.now();
  const course = await createCourse({
    content: truncated,
    apiKey: apiKey!,
    validateStructure: true,
    validateContent: true,
    retryFailures: true,
    maxRetries: 3,
  });
  const courseTimeMs = Date.now() - courseStart;

  const questions: Question[] = [];
  let totalLessons = 0;
  let successfulLessons = 0;

  course.modules.forEach((mod, mi) => {
    mod.lessons.forEach((lr, li) => {
      totalLessons++;
      if (lr.success) {
        successfulLessons++;
        questions.push({
          file: fileName,
          moduleTitle: mod.title,
          moduleIndex: mi,
          lessonTitle: lr.data.title,
          lessonIndex: li,
          questionType: lr.data.questionType,
          question: lr.data.question,
          answer: lr.data.answer,
        });
      }
    });
  });

  const totalMs = Date.now() - ocrStart;
  console.log(`  ✅ Done: ${fileName} — ${questions.length} questions in ${(totalMs / 1000).toFixed(1)}s`);

  return { file: fileName, questions, totalLessons, successfulLessons, timeMs: totalMs };
}

function normalize(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Simple word-overlap similarity (Jaccard) */
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" "));
  const wordsB = new Set(normalize(b).split(" "));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

function findDuplicates(questions: Question[], threshold: number = 0.7): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < questions.length; i++) {
    if (assigned.has(i)) continue;

    const group: Question[] = [questions[i]];
    assigned.add(i);

    for (let j = i + 1; j < questions.length; j++) {
      if (assigned.has(j)) continue;

      const sim = similarity(questions[i].question, questions[j].question);
      if (sim >= threshold) {
        group.push(questions[j]);
        assigned.add(j);
      }
    }

    if (group.length > 1) {
      groups.push({ question: questions[i].question, occurrences: group });
    }
  }

  return groups;
}

async function main() {
  const pdfFiles = readdirSync(PDFS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .map((f) => resolve(PDFS_DIR, f));

  console.log(`\n🏁 Duplicate Question Benchmark`);
  console.log(`   PDFs: ${pdfFiles.length}`);
  console.log(`   Files: ${pdfFiles.map((f) => basename(f)).join(", ")}`);
  console.log("═".repeat(60));

  // Run ALL PDFs in parallel, catching per-PDF errors
  const startTime = Date.now();
  const results = await Promise.all(
    pdfFiles.map(async (f) => {
      try {
        return await processPdf(f);
      } catch (error: any) {
        console.error(`  ❌ FAILED ${basename(f)}: ${error.message}`);
        return {
          file: basename(f),
          questions: [],
          totalLessons: 0,
          successfulLessons: 0,
          timeMs: 0,
        } as CourseResult;
      }
    })
  );
  const totalTimeMs = Date.now() - startTime;

  // Collect all questions
  const allQuestions = results.flatMap((r) => r.questions);
  const totalLessons = results.reduce((s, r) => s + r.totalLessons, 0);
  const totalSuccessful = results.reduce((s, r) => s + r.successfulLessons, 0);

  console.log("\n" + "═".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("═".repeat(60));
  console.log(`  Total time:       ${(totalTimeMs / 1000).toFixed(1)}s`);
  console.log(`  Total lessons:    ${totalLessons}`);
  console.log(`  Successful:       ${totalSuccessful}`);
  console.log(`  Total questions:  ${allQuestions.length}`);

  // --- Per-course duplicate analysis ---
  console.log("\n" + "─".repeat(60));
  console.log("PER-COURSE DUPLICATE ANALYSIS");
  console.log("─".repeat(60));

  let totalWithinCourseDupes = 0;

  for (const result of results) {
    const dupes = findDuplicates(result.questions);
    const dupeCount = dupes.reduce((s, g) => s + g.occurrences.length, 0);
    totalWithinCourseDupes += dupes.length;

    if (dupes.length > 0) {
      console.log(`\n  📕 ${result.file} — ${dupes.length} duplicate group(s) (${dupeCount} questions involved)`);
      for (const group of dupes) {
        console.log(`    🔁 "${group.question.substring(0, 80)}${group.question.length > 80 ? "..." : ""}"`);
        for (const occ of group.occurrences) {
          console.log(`       └─ Module ${occ.moduleIndex + 1} "${occ.moduleTitle}" / Lesson ${occ.lessonIndex + 1} (${occ.questionType})`);
        }
      }
    } else {
      console.log(`\n  ✅ ${result.file} — no duplicates within course`);
    }
  }

  // --- Cross-course duplicate analysis ---
  console.log("\n" + "─".repeat(60));
  console.log("CROSS-COURSE DUPLICATE ANALYSIS");
  console.log("─".repeat(60));

  const crossDupes = findDuplicates(allQuestions);
  // Filter to only groups spanning multiple files
  const crossFileDupes = crossDupes.filter((g) => {
    const files = new Set(g.occurrences.map((o) => o.file));
    return files.size > 1;
  });

  if (crossFileDupes.length > 0) {
    console.log(`  Found ${crossFileDupes.length} duplicate group(s) across files:`);
    for (const group of crossFileDupes) {
      console.log(`\n    🔁 "${group.question.substring(0, 80)}${group.question.length > 80 ? "..." : ""}"`);
      for (const occ of group.occurrences) {
        console.log(`       └─ ${occ.file} / Module "${occ.moduleTitle}" (${occ.questionType})`);
      }
    }
  } else {
    console.log("  ✅ No duplicates found across different courses");
  }

  // --- Overall stats ---
  console.log("\n" + "═".repeat(60));
  console.log("DUPLICATE STATS");
  console.log("═".repeat(60));

  const allDupes = findDuplicates(allQuestions);
  const questionsInDupeGroups = allDupes.reduce((s, g) => s + g.occurrences.length, 0);
  const uniqueQuestions = allQuestions.length - questionsInDupeGroups + allDupes.length;

  console.log(`  Total questions generated:    ${allQuestions.length}`);
  console.log(`  Unique questions:             ${uniqueQuestions}`);
  console.log(`  Duplicate groups:             ${allDupes.length}`);
  console.log(`  Questions in duplicate groups: ${questionsInDupeGroups}`);
  console.log(`  Duplication rate:             ${((questionsInDupeGroups / allQuestions.length) * 100).toFixed(1)}%`);
  console.log(`  Within-course dupe groups:    ${totalWithinCourseDupes}`);
  console.log(`  Cross-course dupe groups:     ${crossFileDupes.length}`);

  // --- List ALL questions for review ---
  console.log("\n" + "─".repeat(60));
  console.log("ALL QUESTIONS GENERATED");
  console.log("─".repeat(60));
  for (const result of results) {
    console.log(`\n  📕 ${result.file}`);
    for (const q of result.questions) {
      console.log(`    [M${q.moduleIndex + 1}L${q.lessonIndex + 1}] (${q.questionType.padEnd(16)}) ${q.question}`);
    }
  }

  // Save results to JSON
  if (!existsSync(BENCHMARKS_DIR)) {
    mkdirSync(BENCHMARKS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const outputPath = resolve(BENCHMARKS_DIR, `duplicates-${timestamp}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    totalTimeMs,
    summary: {
      totalPdfs: pdfFiles.length,
      totalLessons,
      totalSuccessful,
      totalQuestions: allQuestions.length,
      uniqueQuestions,
      duplicateGroups: allDupes.length,
      questionsInDuplicateGroups: questionsInDupeGroups,
      duplicationRate: `${((questionsInDupeGroups / allQuestions.length) * 100).toFixed(1)}%`,
      withinCourseDupeGroups: totalWithinCourseDupes,
      crossCourseDupeGroups: crossFileDupes.length,
    },
    perCourse: results.map((r) => ({
      file: r.file,
      totalLessons: r.totalLessons,
      successfulLessons: r.successfulLessons,
      questions: r.questions,
      duplicates: findDuplicates(r.questions),
    })),
    allDuplicates: allDupes,
    crossCourseDuplicates: crossFileDupes,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
