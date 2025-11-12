import { generateText } from "ai";
import type { Lesson, FixAttempt } from "./types";
import { validateLessonsStructure } from "./validate-lesson-structure";
import { validateLesson } from "./create-lesson";
import { extractXml, createXMLParser } from "./utils/xml";
import { QuestionType } from "./types";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";

// Internal type for fix-lesson operations
interface LessonFailure {
  lesson: any;
  validationType: "structure" | "content";
  reason: string;
  details?: string[];
  attempts?: number;
  fixHistory?: FixAttempt[];
}

export interface FixLessonInput {
  failure: LessonFailure;
  moduleTitle: string;
  content: string;
  apiKey: string;
  maxRetries?: number;
}

export interface FixLessonResult {
  success: boolean;
  lesson?: Lesson;
  failure?: LessonFailure;
  attempts: number;
}

/**
 * Attempts to fix a failed lesson by asking the LLM to regenerate it
 * based on the validation errors. Validates the fixed lesson and retries
 * if it still fails.
 */
export async function fixLesson({
  failure,
  moduleTitle,
  content,
  apiKey,
  maxRetries = 3,
}: FixLessonInput): Promise<FixLessonResult> {
  const together = createTogetherClient(apiKey);
  const originalLesson = failure.lesson;
  const failureDetails = failure.details?.join("\n") || failure.reason;
  const fixHistory: FixAttempt[] = [];

  // Add the original failure to history
  fixHistory.push({
    attempt: 0,
    validationType: failure.validationType,
    reason: failure.reason,
    details: failure.details || [],
    lesson: originalLesson, // Snapshot of the original failed lesson
  });

  console.log(
    `🔧 Attempting to fix lesson "${originalLesson.title}" (max ${maxRetries} retries)...`
  );

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ask LLM to fix the lesson
      const result = await generateText({
        model: together(DEFAULT_MODEL),
        prompt: `You are tasked with fixing a lesson that failed validation. The original lesson had the following problems:

${failureDetails}

Module Title: ${moduleTitle}

Original Lesson:
Title: ${originalLesson.title}
Content: ${originalLesson.content || "N/A"}
Question: ${originalLesson.question || "N/A"}
Question Type: ${originalLesson.questionType || "N/A"}
${
  originalLesson.answer !== undefined
    ? `Answer: ${JSON.stringify(originalLesson.answer)}`
    : ""
}
${
  originalLesson.choices
    ? `Choices: ${JSON.stringify(originalLesson.choices)}`
    : ""
}

Source Material:
${content}

Please generate a CORRECTED lesson that addresses all the validation issues. The lesson must be:
- Factually accurate based on the source material
- Have a clear, well-written question that tests understanding
- Have a correct answer that can be verified from the source material
- For multiple-choice questions, have 4 distinct, plausible choices where only one is correct
- For multiple-choice questions, the answer should be the index (0-3) of the correct choice

Respond ONLY with XML in this exact format:

<lesson title="Lesson Title" questionType="${
          originalLesson.questionType || QuestionType.ShortAnswer
        }">
  <content>Detailed educational content here (2-3 sentences minimum)</content>
  <info>Key takeaway or summary (1 sentence)</info>
  <question>Clear question that tests understanding</question>
  ${
    originalLesson.questionType === QuestionType.MultipleChoice
      ? `<choices>
    <choice>First option</choice>
    <choice>Second option</choice>
    <choice>Third option</choice>
    <choice>Fourth option</choice>
  </choices>`
      : ""
  }
  <answer>${
    originalLesson.questionType === QuestionType.MultipleChoice
      ? "0"
      : originalLesson.questionType === QuestionType.TrueFalse
      ? "true"
      : "Your answer here"
  }</answer>
</lesson>

Valid questionType values: ${Object.values(QuestionType).join(", ")}
For numeric/quantitative questions, you can use numbers as choices (e.g., <choice>256</choice>).
For multiple-choice questions, the answer must be the INDEX (0, 1, 2, or 3) of the correct choice.`,
      });

      // Extract and parse the XML
      const xmlText = extractXml(result.text, "lesson");
      const parser = createXMLParser(["choice"]);
      const parsed = parser.parse(xmlText);

      let fixedLesson = parsed.lesson;

      // Post-process: flatten choices and convert answer types
      // Handle both nested structure (choices.choice[]) and flat structure (choice[])
      if (fixedLesson.choices?.choice) {
        fixedLesson.choices = fixedLesson.choices.choice;
      } else if (fixedLesson.choice) {
        // LLM sometimes generates <choice> directly without wrapping <choices>
        fixedLesson.choices = fixedLesson.choice;
        delete fixedLesson.choice;
      }

      if (fixedLesson.questionType === QuestionType.MultipleChoice) {
        fixedLesson.answer = parseInt(fixedLesson.answer, 10);
      } else if (fixedLesson.questionType === QuestionType.TrueFalse) {
        fixedLesson.answer =
          fixedLesson.answer === "true" || fixedLesson.answer === true;
      }

      // Run structure validation
      const structureValidation = validateLessonsStructure([fixedLesson]);
      const structureErrors = structureValidation.errors.filter(
        (e) => e.severity === "error"
      );

      if (structureErrors.length > 0) {
        console.log(
          `❌ Attempt ${attempt}/${maxRetries}: Structure validation failed`
        );

        // Add to history
        fixHistory.push({
          attempt,
          validationType: "structure",
          reason: "Structure validation failed",
          details: structureErrors.map((e) => e.message),
          lesson: fixedLesson, // Snapshot of the lesson at this attempt
        });

        if (attempt === maxRetries) {
          return {
            success: false,
            failure: {
              lesson: fixedLesson,
              validationType: "structure",
              reason: `Failed to fix lesson after ${maxRetries} attempts (structure errors)`,
              details: structureErrors.map((e) => e.message),
              attempts: maxRetries,
              fixHistory,
            },
            attempts: attempt,
          };
        }
        continue;
      }

      // Run content validation
      const contentValidation = await validateLesson({
        lesson: fixedLesson as Lesson,
        moduleTitle,
        content,
        apiKey,
      });

      if (!contentValidation.isValid) {
        console.log(
          `❌ Attempt ${attempt}/${maxRetries}: Content validation failed`
        );

        const details: string[] = [contentValidation.explanation];
        if (contentValidation.issues) {
          Object.entries(contentValidation.issues).forEach(([field, issue]) => {
            details.push(`[${field}] ${issue}`);
          });
        }

        // Add to history
        fixHistory.push({
          attempt,
          validationType: "content",
          reason: "Content validation failed",
          details,
          lesson: fixedLesson, // Snapshot of the lesson at this attempt
        });

        if (attempt === maxRetries) {
          return {
            success: false,
            failure: {
              lesson: fixedLesson,
              validationType: "content",
              reason: `Failed to fix lesson after ${maxRetries} attempts (content errors)`,
              details,
              attempts: maxRetries,
              fixHistory,
            },
            attempts: attempt,
          };
        }
        continue;
      }

      // Success!
      console.log(`✅ Successfully fixed lesson on attempt ${attempt}`);

      // Attach fix history to the lesson
      const lessonWithHistory = fixedLesson as Lesson;
      lessonWithHistory.fixHistory = fixHistory;

      return {
        success: true,
        lesson: lessonWithHistory,
        attempts: attempt,
      };
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt}/${maxRetries}: Error during fix:`,
        error
      );

      // Add to history
      fixHistory.push({
        attempt,
        validationType: failure.validationType,
        reason: "Error during generation",
        details: [
          `Fix attempt error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
        lesson: originalLesson, // Original lesson since generation failed
      });

      if (attempt === maxRetries) {
        return {
          success: false,
          failure: {
            lesson: originalLesson,
            validationType: failure.validationType,
            reason: `Failed to fix lesson after ${maxRetries} attempts (errors during generation)`,
            details: [
              ...(failure.details || []),
              `Fix attempt error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ],
            attempts: maxRetries,
            fixHistory,
          },
          attempts: attempt,
        };
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    failure: {
      ...failure,
      attempts: maxRetries,
      fixHistory,
    },
    attempts: maxRetries,
  };
}
