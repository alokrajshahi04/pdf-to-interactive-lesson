import { generateText, generateObject, tool, stepCountIs } from "ai";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { z } from "zod";

// Configure Together AI client
const together = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});

// Schema for course structure
const courseStructureSchema = z.object({
  title: z.string().describe("Course title derived from content"),
  description: z.string().describe("Brief course description"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .describe("Overall course difficulty"),
  estimatedDurationMinutes: z
    .number()
    .describe("Estimated time to complete in minutes"),
  modules: z
    .array(
      z.object({
        id: z.string().describe("Unique module identifier"),
        title: z.string().describe("Module title"),
        description: z.string().describe("What this module covers"),
        order: z.number().describe("Module sequence number"),
        keyTopics: z
          .array(z.string())
          .describe("Main topics covered in this module"),
      })
    )
    .min(1)
    .max(10)
    .describe("Course modules"),
});

type CourseStructure = z.infer<typeof courseStructureSchema>;

export async function generateCourseWithAgent(markdownContent: string) {
  const tools = {
    analyzeDocumentStructure: tool({
      description:
        "Analyzes the document and creates a course structure with 1-10 modules.",
      parameters: z.object({
        proceed: z.boolean().optional().describe("Set to true to proceed"),
      }),
      // @ts-expect-error - AI SDK v5 tool type inference issue
      execute: async ({ proceed }: { proceed?: boolean }) => {
        // Tool has content via closure and makes ALL decisions
        const structure = await generateObject({
          model: together("moonshotai/Kimi-K2-Instruct-0905"),
          schema: courseStructureSchema,
          prompt: `Analyze this content and create a course structure.

Decide:
- Course title and description
- How many modules (1-10) based on content scope
- Overall difficulty level
- Module breakdown with clear topics

Create modules that:
- Follow a logical learning progression
- Group related concepts together
- Are appropriately scoped (not too broad or narrow)
- Build upon each other

Content:
${markdownContent}`,
        });

        return structure.object;
      },
    }),
  };

  const result = await generateText({
    // Using Kimi-K2 model that supports tool calling
    model: together("moonshotai/Kimi-K2-Instruct-0905"),
    tools,
    stopWhen: [stepCountIs(10)],

    // Force start with structure analysis
    toolChoice: {
      type: "tool",
      toolName: "analyzeDocumentStructure",
    },

    prompt: `You are a course generation system. Create an interactive course from the provided content.

The content is approximately ${Math.round(
      markdownContent.length / 1000
    )}k characters of educational material.

Start by analyzing the document structure to create a course outline.`,
  });

  return result;
}
