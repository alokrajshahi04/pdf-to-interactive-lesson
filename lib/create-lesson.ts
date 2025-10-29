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
import { together, DEFAULT_MODEL } from "./utils/together";

export interface CreateLessonsInput {
  module: Module;
  content: string;
  validateStructure?: boolean; // If true, runs deterministic structure validation (default: true)
  validateContent?: boolean; // If true, runs LLM-based content validation (default: true)
  retryFailures?: boolean; // If true, attempts to fix failed lessons (default: true)
  maxRetries?: number; // Maximum number of retry attempts for fixing lessons (default: 3)
}

export interface ValidateLessonInput {
  lesson: Lesson;
  moduleTitle: string;
  content: string;
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
  validateStructure = true,
  validateContent = true,
  retryFailures = true,
  maxRetries = 3,
}: CreateLessonsInput): Promise<ModuleWithLessons> {
  const result = await generateText({
    model: together(DEFAULT_MODEL),
    prompt: `Analyse the following content and create 3 lessons for the module "${module.title}".
Respond only with XML format. Do not include any other text.

IMPORTANT: You must use these exact questionType values:
- "short-answer" - For open-ended text questions (answer is text)
- "true-false" - For true/false questions (answer must be "true" or "false")
- "multiple-choice" - For multiple choice questions (answer is index 0-3, must include <choices>)

Try to create questions which cover each of the three question types listed above.
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

  const parser = createXMLParser(["lesson", "choice"]);

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

          // Convert answer based on questionType
          if (lesson.questionType === QuestionType.MultipleChoice) {
            processed.answer = parseInt(lesson.answer, 10);
          } else if (lesson.questionType === QuestionType.TrueFalse) {
            processed.answer =
              lesson.answer === "true" || lesson.answer === true;
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

    // Run LLM-based content validation if requested
    if (validateContent && lessonStructure.module?.lessons) {
      console.log(
        `🔍 Validating lesson content for module "${module.title}"...`
      );

      for (let i = 0; i < lessonStructure.module.lessons.length; i++) {
        // Skip if already failed structure validation
        if (failuresByIndex.has(i)) {
          continue;
        }

        const lesson = lessonStructure.module.lessons[i];
        const validation = await validateLesson({
          lesson,
          moduleTitle: module.title,
          content,
        });

        if (!validation.isValid) {
          const details: string[] = [validation.explanation];
          if (validation.issues) {
            Object.entries(validation.issues).forEach(([field, issue]) => {
              details.push(`[${field}] ${issue}`);
            });
          }

          failuresByIndex.set(i, {
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

    // Attempt to fix failed lessons if requested
    if (retryFailures && failuresByIndex.size > 0) {
      console.log(
        `\n🔧 Attempting to fix ${failuresByIndex.size} failed lesson(s) for module "${module.title}"...`
      );

      for (const [index, failedLesson] of failuresByIndex.entries()) {
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
          maxRetries,
        });

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

    return {
      title: lessonStructure.module.title,
      lessons: lessonResults,
    };
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
}: ValidateLessonInput): Promise<ValidationResult> {
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
