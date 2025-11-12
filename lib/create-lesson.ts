import { generateText } from "ai";
import {
  QuestionType,
  type Module,
  type Lesson,
  type MultipleChoiceLesson,
  type ModuleWithLessons,
  type LessonResult,
  type FailedLesson,
} from "./types";
import { createXMLParser, extractJson } from "./utils/xml";
import { validateLessonsStructure } from "./validate-lesson-structure";
import { fixLesson } from "./fix-lesson";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";

export interface LessonProgressCallback {
  (type: string, message: string, data?: any): void;
}

export interface CreateLessonsInput {
  module: Module;
  content: string;
  apiKey: string;
  validateStructure?: boolean; // If true, runs deterministic structure validation (default: true)
  validateContent?: boolean; // If true, runs LLM-based content validation (default: true)
  retryFailures?: boolean; // If true, attempts to fix failed lessons (default: true)
  maxRetries?: number; // Maximum number of retry attempts for fixing lessons (default: 3)
  onProgress?: LessonProgressCallback;
}

export interface ValidateLessonInput {
  lesson: Lesson;
  moduleTitle: string;
  content: string;
  apiKey: string;
}

export interface ValidationResult {
  isValid: boolean;
  explanation: string;
  issues?: {
    content?: string;
    question?: string;
    answer?: string;
    choices?: string;
  };
}

export async function createLessons({
  module,
  content,
  apiKey,
  validateStructure = true,
  validateContent = true,
  retryFailures = true,
  maxRetries = 3,
  onProgress,
}: CreateLessonsInput): Promise<ModuleWithLessons> {
  onProgress?.("lesson-start", `Generating lessons for "${module.title}"...`);
  const together = createTogetherClient(apiKey);
  const result = await generateText({
    model: together(DEFAULT_MODEL),
    prompt: `Analyse the following content and create 4 lessons for the module "${module.title}".
Respond only with XML format. Do not include any other text.

IMPORTANT: You must create exactly ONE lesson for EACH of these question types:
1. "short-answer" - For open-ended text questions (answer is text)
2. "true-false" - For true/false questions (answer must be "true" or "false")
3. "multiple-choice" - For multiple choice questions (answer is index 0-3, must include <choices>)
4. "drag-drop" - For drag-and-drop matching questions (answer is array of 3 numbers, must include <choices> and <slots>)

You MUST create one lesson for each question type. Do not skip any question type.
Your response should ONLY contain the XML format following this structure:

<module title="${module.title}">
  <lesson title="Lesson 1 Title" questionType="short-answer">
    <content>Lesson 1 Content. About 3 sentences long.</content>
    <info>A quick one sentence fact within the lesson content to highlight a key point</info>
    <question>A question to ask the user to test their understanding of the lesson content</question>
    <answer>The answer to the question</answer>
  </lesson>
  <lesson title="Lesson 2 Title" questionType="true-false">
    <content>Lesson 2 Content. About 3 sentences long.</content>
    <info>A quick one sentence fact within the lesson content to highlight a key point</info>
    <question>A statement that is either true or false</question>
    <answer>true</answer>
  </lesson>
  <lesson title="Lesson 3 Title" questionType="multiple-choice">
    <content>Lesson 3 Content. About 3 sentences long.</content>
    <info>A quick one sentence fact within the lesson content to highlight a key point</info>
    <question>A multiple choice question to ask the user</question>
    <answer>1</answer>
    <choices>
      <choice>First option</choice>
      <choice>Second option (CORRECT)</choice>
      <choice>Third option</choice>
      <choice>Fourth option</choice>
    </choices>
  </lesson>
  <lesson title="Lesson 4 Title" questionType="drag-drop">
    <content>Lesson 4 Content. About 3 sentences long.</content>
    <info>A quick one sentence fact within the lesson content to highlight a key point</info>
    <question>Match the items to their correct categories by dragging choices to slots</question>
    <answer>0,2,1</answer>
    <choices>
      <choice>Choice A</choice>
      <choice>Choice B</choice>
      <choice>Choice C</choice>
    </choices>
    <slots>
      <slot>Slot 1 Label</slot>
      <slot>Slot 2 Label</slot>
      <slot>Slot 3 Label</slot>
    </slots>
  </lesson>

Note: For drag-drop questions:
- Must have exactly 3 choices and 3 slots
- Answer format: "0,2,1" means slot 0 gets choice 0, slot 1 gets choice 2, slot 2 gets choice 1
- Each choice must be used exactly once

Note: For numeric questions (years, scores, percentages, etc.), choices can be numbers:
  <choices>
    <choice>88.3</choice>
    <choice>91.7</choice>
    <choice>92.7</choice>
  </choices>
</module>

Content:
${content}`,
  });

  const parser = createXMLParser(["lesson", "choice", "slot"]);

  try {
    const lessonStructure = parser.parse(result.text);

    // Track failures by lesson index
    const failuresByIndex = new Map<number, FailedLesson>();

    // Rename lesson to lessons (plural) for consistency
    if (lessonStructure.module?.lesson) {
      lessonStructure.module.lessons = lessonStructure.module.lesson;
      delete lessonStructure.module.lesson;
    }

    // Post-process to flatten choices and convert answer types
    if (lessonStructure.module?.lessons) {
      lessonStructure.module.lessons = lessonStructure.module.lessons.map(
        (lesson: any) => {
          const processed: any = { ...lesson };

          // Flatten choices.choice[] to choices[]
          // Handle both nested structure (choices.choice[]) and flat structure (choice[])
          if (lesson.choices?.choice) {
            processed.choices = lesson.choices.choice;
          } else if (lesson.choice) {
            // LLM sometimes generates <choice> directly without wrapping <choices>
            processed.choices = lesson.choice;
            delete processed.choice;
          }

          // Flatten slots.slot[] to slots[]
          // Handle both nested structure (slots.slot[]) and flat structure (slot[])
          if (lesson.slots?.slot) {
            processed.slots = lesson.slots.slot;
          } else if (lesson.slot) {
            // LLM sometimes generates <slot> directly without wrapping <slots>
            processed.slots = lesson.slot;
            delete processed.slot;
          }

          // Convert answer based on questionType
          if (lesson.questionType === QuestionType.MultipleChoice) {
            processed.answer = parseInt(lesson.answer, 10);
          } else if (lesson.questionType === QuestionType.TrueFalse) {
            processed.answer =
              lesson.answer === "true" || lesson.answer === true;
          } else if (lesson.questionType === QuestionType.DragDrop) {
            // Parse comma-separated string to array of numbers
            if (typeof lesson.answer === "string") {
              processed.answer = lesson.answer.split(",").map((val: string) => parseInt(val.trim(), 10));
            } else if (Array.isArray(lesson.answer)) {
              processed.answer = lesson.answer.map((val: any) => parseInt(val, 10));
            }
          }
          // short-answer keeps answer as string (no conversion needed)

          return processed;
        }
      );
    }

    // Run deterministic structure validation if requested
    if (validateStructure && lessonStructure.module?.lessons) {
      const validationResult = validateLessonsStructure(
        lessonStructure.module.lessons
      );

      // Log warnings
      const warnings = validationResult.errors.filter(
        (e) => e.severity === "warning"
      );
      if (warnings.length > 0) {
        console.warn(
          `⚠️  Found ${warnings.length} validation warning(s) for module "${module.title}":`
        );
        warnings.forEach((warning) => {
          console.warn(`  - [${warning.field}] ${warning.message}`);
        });
      }

      // Collect structure validation errors (don't throw)
      const errors = validationResult.errors.filter(
        (e) => e.severity === "error"
      );

      if (errors.length > 0) {
        // Group errors by lesson index
        const errorsByLesson = new Map<number, string[]>();
        errors.forEach((error) => {
          const match = error.field.match(/^lesson\[(\d+)\]/);
          if (match) {
            const index = parseInt(match[1], 10);
            if (!errorsByLesson.has(index)) {
              errorsByLesson.set(index, []);
            }
            errorsByLesson.get(index)!.push(error.message);
          }
        });

        // Mark lessons as failed
        errorsByLesson.forEach((details, index) => {
          const lesson = lessonStructure.module.lessons[index];
          failuresByIndex.set(index, {
            success: false,
            data: lesson || { title: `Lesson ${index + 1}` },
            error: {
              validationType: "structure",
              reason: "Structure validation failed",
              details,
            },
          });
        });

        console.error(
          `❌ ${failuresByIndex.size} lesson(s) failed structure validation for module "${module.title}"`
        );
      }
    }

    // Run LLM-based content validation if requested (concurrently)
    if (validateContent && lessonStructure.module?.lessons) {
      console.log(
        `🔍 Validating lesson content for module "${module.title}"...`
      );

      // Validate all lessons concurrently
      const validationPromises = lessonStructure.module.lessons.map(
        async (lesson: any, i: number) => {
          // Skip if already failed structure validation
          if (failuresByIndex.has(i)) {
            return { index: i, lesson, validation: null };
          }

          const validation = await validateLesson({
            lesson,
            moduleTitle: module.title,
            content,
            apiKey,
          });

          return { index: i, lesson, validation };
        }
      );

      const validationResults = await Promise.all(validationPromises);

      // Process validation results
      for (const { index, lesson, validation } of validationResults) {
        if (!validation) continue; // Already failed structure validation

        if (!validation.isValid) {
          const details: string[] = [validation.explanation];
          if (validation.issues) {
            Object.entries(validation.issues).forEach(([field, issue]) => {
              details.push(`[${field}] ${issue}`);
            });
          }

          failuresByIndex.set(index, {
            success: false,
            data: lesson,
            error: {
              validationType: "content",
              reason: "Content validation failed",
              details,
            },
          });

          console.error(
            `❌ Lesson "${lesson.title}" failed content validation`
          );
        } else {
          // Log warnings for lessons that passed but have concerns
          if (validation.issues) {
            console.warn(`⚠️  Lesson "${lesson.title}" has minor issues:`);
            Object.entries(validation.issues).forEach(([field, issue]) => {
              console.warn(`  - [${field}] ${issue}`);
            });
          }
        }
      }

      const passedCount =
        lessonStructure.module.lessons.length - failuresByIndex.size;
      console.log(
        `✅ ${passedCount}/${lessonStructure.module.lessons.length} lessons passed validation for module "${module.title}"`
      );
    }

    // Attempt to fix failed lessons if requested (concurrently)
    if (retryFailures && failuresByIndex.size > 0) {
      console.log(
        `\n🔧 Attempting to fix ${failuresByIndex.size} failed lesson(s) for module "${module.title}"...`
      );

      // Fix all failed lessons concurrently
      const fixPromises = Array.from(failuresByIndex.entries()).map(
        async ([index, failedLesson]) => {
          // Convert FailedLesson to the format expected by fixLesson
          const failure = {
            lesson: failedLesson.data,
            validationType: failedLesson.error.validationType,
            reason: failedLesson.error.reason,
            details: failedLesson.error.details,
          };

          const fixResult = await fixLesson({
            failure,
            moduleTitle: module.title,
            content,
            apiKey,
            maxRetries,
          });

          return { index, fixResult };
        }
      );

      const fixResults = await Promise.all(fixPromises);

      // Process fix results
      for (const { index, fixResult } of fixResults) {
        if (fixResult.success && fixResult.lesson) {
          // Replace the lesson at this index with the fixed version
          lessonStructure.module.lessons[index] = fixResult.lesson;
          // Remove from failures map (it's now successful)
          failuresByIndex.delete(index);
          console.log(
            `✅ Fixed lesson "${fixResult.lesson.title}" after ${fixResult.attempts} attempt(s)`
          );
        } else if (fixResult.failure) {
          // Update the failure with attempts and fixHistory
          failuresByIndex.set(index, {
            success: false,
            data: fixResult.failure.lesson,
            error: {
              validationType: fixResult.failure.validationType,
              reason: fixResult.failure.reason,
              details: fixResult.failure.details,
              attempts: fixResult.failure.attempts,
              fixHistory: fixResult.failure.fixHistory,
            },
          });
        }
      }

      const fixedCount =
        lessonStructure.module.lessons.length - failuresByIndex.size;
      if (fixedCount > 0) {
        console.log(`\n✅ Successfully fixed ${fixedCount} lesson(s)`);
      }

      if (failuresByIndex.size > 0) {
        console.log(
          `⚠️  ${failuresByIndex.size} lesson(s) could not be fixed after ${maxRetries} attempts`
        );
      }
    }

    // Build final lessons array with success/failure status
    const lessonResults: LessonResult[] = lessonStructure.module.lessons.map(
      (lesson: any, index: number) => {
        const failure = failuresByIndex.get(index);
        if (failure) {
          return failure;
        }
        return {
          success: true,
          data: lesson,
        };
      }
    );

    const moduleResult = {
      title: lessonStructure.module.title,
      lessons: lessonResults,
    };

    // Send completion progress
    const successfulCount = lessonResults.filter((r) => r.success).length;
    onProgress?.("lesson-complete", `Completed "${module.title}" (${successfulCount}/${lessonResults.length} lessons)`, {
      moduleTitle: module.title,
      successful: successfulCount,
      total: lessonResults.length,
    });

    return moduleResult;
  } catch (error) {
    console.error("XML parsing error for module:", module.title);
    console.error("Raw response:", result.text.substring(0, 500));
    throw error;
  }
}

export async function validateLesson({
  lesson,
  moduleTitle,
  content,
  apiKey,
}: ValidateLessonInput): Promise<ValidationResult> {
  const together = createTogetherClient(apiKey);
  
  // Format lesson data for validation
  const lessonData = {
    title: lesson.title,
    content: lesson.content,
    info: lesson.info,
    question: lesson.question,
    questionType: lesson.questionType,
    answer: lesson.answer,
    ...(lesson.questionType === QuestionType.MultipleChoice && {
      choices: (lesson as MultipleChoiceLesson).choices,
    }),
  };

  const result = await generateText({
    model: together(DEFAULT_MODEL),
    prompt: `You are a lesson quality validator. Validate the following lesson against the source content.

Module: "${moduleTitle}"

Lesson to Validate:
${JSON.stringify(lessonData, null, 2)}

Source Content:
${content}

Validation Criteria:
1. CONTENT: Is the lesson content factually accurate based on the source?
2. QUESTION: Is the question clear, relevant, and properly tests understanding?
3. ANSWER: Is the answer correct based on the source content?
4. CHOICES (if multiple-choice): Are all choices plausible? Is the correct answer index accurate?
5. INFO: Does the highlighted info fact come from the lesson content?

Respond ONLY with valid JSON in this exact format:
{
  "isValid": true or false,
  "explanation": "Brief overall assessment",
  "issues": {
    "content": "Issue with content (if any)",
    "question": "Issue with question (if any)",
    "answer": "Issue with answer (if any)",
    "choices": "Issue with choices (if any)"
  }
}

If there are no issues, omit the "issues" field entirely.
Only include specific issue fields that have problems.`,
  });

  try {
    // Extract JSON from response (in case there's extra text)
    const jsonText = extractJson(result.text);
    const validation = JSON.parse(jsonText);

    return {
      isValid: validation.isValid,
      explanation: validation.explanation,
      issues: validation.issues,
    };
  } catch (error) {
    console.error("Failed to parse validation response:", result.text);
    return {
      isValid: false,
      explanation: "Failed to validate lesson - invalid response format",
      issues: {
        content: "Validation error",
      },
    };
  }
}
