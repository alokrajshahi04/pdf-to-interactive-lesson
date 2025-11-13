import { writeFile, unlink } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import axios from "axios";
import { ocr } from "./ocr";
import { createCourse } from "./create-course";
import type { CourseOutput } from "./create-course";
import { getPdfInfo } from "./utils/railway-pdf-service";

/**
 * Calculate statistics about lesson generation results
 */
function calculateLessonStats(course: CourseOutput) {
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

  return { total, successful, fixed, failed, fixAttempts };
}

export interface ProgressCallback {
  (type: string, message: string, data?: any): void;
}

export interface GenerateCourseOptions {
  file?: File;
  url?: string;
  apiKey: string;
  onProgress?: ProgressCallback;
}

export interface GenerateCourseResult {
  course: any; // Compatible with both CourseOutput and Course from navigation hook
  metadata: {
    generationTime: string;
    ocrTime: string;
    courseTime: string;
    modulesCount: number;
    lessonsCount: number;
    lessonStats: {
      total: number;
      successful: number;
      fixed: number;
      failed: number;
      fixAttempts: number;
    };
    pages: number;
    tokens: number;
  };
}

/**
 * Generate a course from a PDF file or URL
 * @param options - Configuration options including file/URL, API key, and progress callback
 * @returns Course data and metadata
 */
export async function generateCourseFromPdf(
  options: GenerateCourseOptions
): Promise<GenerateCourseResult> {
  const { file, url, apiKey, onProgress } = options;
  let tempFilePath: string | null = null;
  let isTemp = false;

  try {
    // Check for API key
    if (!apiKey) {
      throw new Error("Together AI API key is required. Please add your API key in the app settings.");
    }

    // Validate input
    if (!file && !url) {
      throw new Error("Either 'file' or 'url' must be provided");
    }

    onProgress?.("init", "Initializing...");

    // Handle URL
    if (url) {
      onProgress?.("download", "Downloading PDF from URL...");
      console.log(`📄 Processing URL: ${url}`);

      // Download to /tmp (serverless-compatible)
      const response = await axios({
        method: "GET",
        url,
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);
      tempFilePath = `/tmp/download-${Date.now()}.pdf`;
      await writeFile(tempFilePath, buffer);
      isTemp = true;
      console.log(`✅ Downloaded to ${tempFilePath}`);
    }
    // Handle file upload
    else if (file) {
      onProgress?.("upload", `Processing uploaded file: ${file.name}`);
      console.log(`📄 Processing uploaded file: ${file.name}`);

      // Save to /tmp for processing
      // Using /tmp makes it serverless-compatible (Vercel, Netlify, etc.)
      const timestamp = Date.now();
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      tempFilePath = `/tmp/upload-${timestamp}.pdf`;
      await writeFile(tempFilePath, buffer);
      isTemp = true;
      console.log(`✅ Saved to temp: ${tempFilePath}`);
    }

    if (!tempFilePath) {
      throw new Error("Failed to process file");
    }

    // Check PDF page count before processing
    onProgress?.("checking", "Checking PDF page count...");
    console.log("📊 Checking PDF page count...");
    const pdfBuffer = readFileSync(tempFilePath);
    const pdfInfo = await getPdfInfo(pdfBuffer);
    
    if (!pdfInfo.success) {
      throw new Error(pdfInfo.error || "Failed to get PDF information");
    }

    const MAX_PAGES = 100;
    if (pdfInfo.pageCount > MAX_PAGES) {
      throw new Error(
        `PDF has ${pdfInfo.pageCount} pages, but we currently only support PDFs up to ${MAX_PAGES} pages. Please upload a shorter document.`
      );
    }

    console.log(`✅ PDF has ${pdfInfo.pageCount} pages (within limit)`);

    // Extract content from PDF
    console.log("🔍 Extracting content...");
    const ocrStartTime = Date.now();

    let result;
    try {
      result = await ocr(tempFilePath, {
        apiKey,
        maintainFormat: false,
        concurrency: 5, // Process 5 pages in parallel for faster processing
        startDelay: 100, // 100ms stagger between starting each request
        onProgress,
      });
    } catch (error) {
      console.error("❌ OCR failed:", error);
      throw error; // Re-throw with original detailed message
    }

    const content = result.pages.map((p) => p.content).join("\n\n");
    const ocrElapsed = ((Date.now() - ocrStartTime) / 1000).toFixed(2);

    onProgress?.("ocr-complete", `OCR completed in ${ocrElapsed}s`, {
      pages: result.pages.length,
      tokens: result.inputTokens,
    });

    // Generate course
    console.log("\n" + "=".repeat(60));
    console.log("🤖 GENERATING COURSE FROM CONTENT");
    console.log("=".repeat(60));
    const courseStartTime = Date.now();

    const course = await createCourse({
      content,
      apiKey,
      validateStructure: true,
      validateContent: true,
      retryFailures: true,
      maxRetries: 3,
      onProgress,
    });

    const courseElapsed = ((Date.now() - courseStartTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total course generation time: ${courseElapsed}s`);

    // Calculate lesson statistics
    const lessonStats = calculateLessonStats(course);

    onProgress?.(
      "course-complete",
      `Generated ${course.modules.length} modules with ${lessonStats.total} lessons`
    );

    // Log summary with clean formatting
    console.log("\n" + "=".repeat(60));
    console.log("📊 COURSE GENERATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`⏱️  Total Time: ${((Date.now() - ocrStartTime + Date.now() - courseStartTime) / 1000).toFixed(2)}s`);
    console.log(`   ├─ OCR: ${ocrElapsed}s (${result.pages.length} pages, ${result.inputTokens.toLocaleString()} tokens)`);
    console.log(`   └─ Course: ${courseElapsed}s`);
    console.log("");
    console.log("📚 Content:");
    console.log(`   ├─ Modules: ${course.modules.length}`);
    console.log(`   └─ Lessons: ${lessonStats.total}`);
    console.log("");
    console.log("✅ Lesson Results:");
    console.log(`   ├─ Successful: ${lessonStats.successful} (${Math.round((lessonStats.successful / lessonStats.total) * 100)}%)`);
    console.log(`   ├─ Fixed: ${lessonStats.fixed} (required retries)`);
    console.log(`   ├─ Failed: ${lessonStats.failed}`);
    console.log(`   └─ Fix Attempts: ${lessonStats.fixAttempts} total`);
    console.log("=".repeat(60) + "\n");

    // Cleanup temp file
    if (isTemp && tempFilePath && existsSync(tempFilePath)) {
      await unlink(tempFilePath);
      console.log("🧹 Cleaned up temporary file");
    }

    // Calculate total time
    const totalElapsed = (
      (Date.now() - ocrStartTime + Date.now() - courseStartTime) /
      1000
    ).toFixed(2);

    return {
      course,
      metadata: {
        generationTime: `${totalElapsed}s`,
        ocrTime: `${ocrElapsed}s`,
        courseTime: `${courseElapsed}s`,
        modulesCount: course.modules.length,
        lessonsCount: lessonStats.total,
        lessonStats,
        pages: result.pages.length,
        tokens: result.inputTokens,
      },
    };
  } catch (error) {
    // Cleanup temp file on error
    if (isTemp && tempFilePath && existsSync(tempFilePath)) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.error("Failed to cleanup temp file:", cleanupError);
      }
    }

    throw error;
  }
}
