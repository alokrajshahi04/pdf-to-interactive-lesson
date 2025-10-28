import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { ocr } from "./ocr";
import { generateCourseWithAgent } from "./agent";

/**
 * Example usage of the course generation agent
 *
 * Prerequisites:
 *   - Set TOGETHER_API_KEY environment variable
 *   - For PDFs: Ensure eng.traineddata is in project root
 *
 * Usage:
 *   bun run lib/agent.example.ts <path-to-file>
 *
 * Supports:
 *   - .md files (uses directly)
 *   - .pdf files (runs OCR first)
 */

async function main() {
  // Check for API key
  if (!process.env.TOGETHER_API_KEY) {
    console.error("❌ Error: TOGETHER_API_KEY environment variable not set");
    console.error("\nSet it with:");
    console.error("  export TOGETHER_API_KEY=your-api-key");
    console.error("or:");
    console.error(
      "  TOGETHER_API_KEY=your-api-key bun run lib/agent.example.ts <file>"
    );
    process.exit(1);
  }

  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: bun run lib/agent.example.ts <path-to-file>");
    console.error("\nExamples:");
    console.error(
      "  bun run lib/agent.example.ts output/f669d9b7e6474e34828602d3bd46c22f.md"
    );
    console.error("  bun run lib/agent.example.ts data/1706.03762v7.pdf");
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📄 Processing: ${filePath}\n`);

  let markdownContent: string;

  // Determine if we need to run OCR
  if (filePath.endsWith(".pdf")) {
    console.log("🔍 Running OCR on PDF...");
    const startTime = Date.now();

    const result = await ocr(filePath, {
      outputDir: "./output",
      maintainFormat: false,
      concurrency: 5,
      cleanup: true,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ OCR completed in ${elapsed}s`);
    console.log(`   Pages: ${result.pages.length}`);
    console.log(`   Input tokens: ${result.inputTokens.toLocaleString()}`);
    console.log(`   Output tokens: ${result.outputTokens.toLocaleString()}\n`);

    markdownContent = result.pages.map((p) => p.content).join("\n\n");
  } else if (filePath.endsWith(".md")) {
    console.log("📖 Reading markdown file...");
    markdownContent = await readFile(filePath, "utf-8");
    console.log(`✅ Loaded ${markdownContent.length} characters\n`);
  } else {
    console.error("Error: File must be .pdf or .md");
    process.exit(1);
  }

  // Generate course with agent
  console.log("🤖 Generating course structure with AI agent...\n");
  console.log("─".repeat(60));

  const startTime = Date.now();

  try {
    const result = await generateCourseWithAgent(markdownContent);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("─".repeat(60));
    console.log(`\n✅ Course generation completed in ${elapsed}s\n`);

    // Display results
    console.log("📊 Results:");
    console.log(`   Steps taken: ${result.steps?.length || 0}`);
    console.log(`   Tool calls: ${result.toolCalls?.length || 0}\n`);

    // Show tool calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log("🔧 Tool Calls:");
      for (const toolCall of result.toolCalls) {
        console.log(`   - ${toolCall.toolName}`);
      }
      console.log();
    }

    // Show tool results
    if (result.toolResults && result.toolResults.length > 0) {
      console.log("📦 Tool Results:");
      for (const toolResult of result.toolResults) {
        console.log(`\n   Tool: ${toolResult.toolName}`);
        const output = (toolResult as any).output;
        if (output) {
          const resultData =
            typeof output === "object"
              ? JSON.stringify(output, null, 2)
              : output;
          console.log(
            `   Result: ${resultData.substring(0, 500)}${
              resultData.length > 500 ? "..." : ""
            }`
          );
        }
      }
      console.log();
    }

    // Show final text response (if any)
    if (result.text) {
      console.log("💬 Agent Response:");
      console.log(result.text);
      console.log();
    }

    // Show usage stats
    if (result.usage) {
      console.log("📈 Token Usage:");
      const usage = result.usage as any;
      console.log(
        `   Prompt tokens: ${(usage.promptTokens || 0).toLocaleString()}`
      );
      console.log(
        `   Completion tokens: ${(
          usage.completionTokens || 0
        ).toLocaleString()}`
      );
      console.log(
        `   Total tokens: ${(usage.totalTokens || 0).toLocaleString()}`
      );
    }

    // If we got a course structure, display it nicely
    if (result.toolResults && result.toolResults.length > 0) {
      const structureResult = result.toolResults.find(
        (r) => r.toolName === "analyzeDocumentStructure"
      );

      if (structureResult) {
        const course = (structureResult as any).output;
        console.log("\n" + "=".repeat(60));
        console.log("📚 COURSE STRUCTURE");
        console.log("=".repeat(60));
        console.log(`\nTitle: ${course.title}`);
        console.log(`Description: ${course.description}`);
        console.log(`Difficulty: ${course.difficulty}`);
        console.log(
          `Estimated Duration: ${course.estimatedDurationMinutes} minutes`
        );
        console.log(`\nModules (${course.modules?.length || 0}):`);

        if (course.modules) {
          for (const module of course.modules) {
            console.log(`\n  ${module.order}. ${module.title}`);
            console.log(`     ${module.description}`);
            if (module.keyTopics?.length > 0) {
              console.log(`     Topics: ${module.keyTopics.join(", ")}`);
            }
          }
        }
        console.log("\n" + "=".repeat(60));
      }
    }
  } catch (error) {
    console.error("\n❌ Error generating course:");
    console.error(error);
    process.exit(1);
  }
}

main();
