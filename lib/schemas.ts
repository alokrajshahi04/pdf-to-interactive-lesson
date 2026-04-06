/**
 * Zod schemas for structured output from LLM generation.
 * These replace the XML templates + postProcessLesson() pipeline.
 */

import { z } from "zod";

// --- Course structure (module generation) ---

export const courseStructureSchema = z.object({
  title: z.string().describe("The course title"),
  modules: z
    .array(
      z.object({
        title: z.string().describe("The module title"),
      })
    )
    .length(3)
    .describe("Exactly 3 modules"),
});

export type CourseStructureOutput = z.infer<typeof courseStructureSchema>;

// --- Standard lessons (short-answer, true-false, multiple-choice) ---

const shortAnswerLessonSchema = z.object({
  title: z.string().describe("Lesson title"),
  content: z.string().describe("Lesson content, about 3 sentences long"),
  info: z.string().describe("A quick one sentence fact to highlight a key point"),
  question: z.string().describe("A question to test understanding"),
  questionType: z.literal("short-answer"),
  answer: z.string().describe("The answer to the question"),
});

const trueFalseLessonSchema = z.object({
  title: z.string().describe("Lesson title"),
  content: z.string().describe("Lesson content, about 3 sentences long"),
  info: z.string().describe("A quick one sentence fact to highlight a key point"),
  question: z.string().describe("A statement that is either true or false"),
  questionType: z.literal("true-false"),
  answer: z.boolean().describe("true or false"),
});

const multipleChoiceLessonSchema = z.object({
  title: z.string().describe("Lesson title"),
  content: z.string().describe("Lesson content, about 3 sentences long"),
  info: z.string().describe("A quick one sentence fact to highlight a key point"),
  question: z.string().describe("A multiple choice question"),
  questionType: z.literal("multiple-choice"),
  answer: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe("Index (0-3) of the correct choice"),
  choices: z
    .array(z.union([z.string(), z.number()]))
    .length(4)
    .describe("Exactly 4 choices"),
  explanation: z
    .string()
    .describe("Brief explanation of why the correct answer is right"),
});

/** Union schema for validating a single lesson of any type */
export const singleLessonSchema = z.discriminatedUnion("questionType", [
  shortAnswerLessonSchema,
  trueFalseLessonSchema,
  multipleChoiceLessonSchema,
]);

export const standardLessonsSchema = z.object({
  lessons: z
    .tuple([shortAnswerLessonSchema, trueFalseLessonSchema, multipleChoiceLessonSchema])
    .describe(
      "Exactly 3 lessons: one short-answer, one true-false, one multiple-choice"
    ),
});

export type StandardLessonsOutput = z.infer<typeof standardLessonsSchema>;

// --- Flow diagram ---

const flowNodeSchema = z.object({
  id: z.string().describe("Unique node ID like step-1"),
  label: z.string().describe("Concise label, 2-5 words"),
  type: z
    .enum(["start", "process", "output"])
    .describe("start for initial, process for steps, output for final"),
});

const flowEdgeSchema = z
  .tuple([z.string(), z.string()])
  .describe("[source node ID, target node ID]");

export const flowAnalysisSchema = z.object({
  hasFlow: z
    .boolean()
    .describe("Whether this content has a process/flow suitable for a diagram"),
  nodes: z
    .array(flowNodeSchema)
    .min(0)
    .max(8)
    .describe("Flow nodes (empty if hasFlow is false)"),
  edges: z
    .array(flowEdgeSchema)
    .min(0)
    .describe("Flow edges (empty if hasFlow is false)"),
});

export type FlowAnalysisOutput = z.infer<typeof flowAnalysisSchema>;

// --- Flow question ---

export const flowQuestionSchema = z.object({
  title: z.string().describe("Lesson title"),
  content: z.string().describe("Brief 2-3 sentence explanation of the flow process"),
  info: z.string().describe("One key fact about this process"),
  question: z
    .string()
    .describe("The ordering question, e.g. 'Put the following steps in the correct order'"),
  stepsInOrder: z
    .array(z.string())
    .length(3)
    .describe("The 3 steps listed in their correct chronological order"),
});

export type FlowQuestionOutput = z.infer<typeof flowQuestionSchema>;

// --- Content validation ---

export const validationResultSchema = z.object({
  isValid: z.boolean(),
  explanation: z.string().describe("Brief overall assessment"),
  issues: z
    .object({
      content: z.string().optional(),
      question: z.string().optional(),
      answer: z.string().optional(),
      choices: z.string().optional(),
      explanation: z.string().optional(),
      slots: z.string().optional(),
    })
    .optional()
    .describe("Only include fields that have problems"),
});

export type ValidationResultOutput = z.infer<typeof validationResultSchema>;

// --- Fix lesson schemas (one per question type) ---

export const fixShortAnswerSchema = shortAnswerLessonSchema;
export const fixTrueFalseSchema = trueFalseLessonSchema;
export const fixMultipleChoiceSchema = multipleChoiceLessonSchema;

export const fixFlowDiagramSchema = z.object({
  title: z.string(),
  content: z.string(),
  info: z.string(),
  question: z.string(),
  choices: z.array(z.string()).length(3),
  slots: z.array(z.string()).length(3),
  answer: z.array(z.number().int().min(0).max(2)).length(3),
});

export type FixFlowDiagramOutput = z.infer<typeof fixFlowDiagramSchema>;
