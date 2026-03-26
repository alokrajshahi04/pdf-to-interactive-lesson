import { generateText, APICallError, RetryError } from "ai";
import {
  QuestionType,
  type Module,
  type Lesson,
  type MultipleChoiceLesson,
  type ModuleWithLessons,
  type LessonResult,
  type FailedLesson,
  type FlowConfig,
  type SimpleEdge,
  type FlowDiagramLesson,
} from "./types";
import {
  standardLessonsSchema,
  singleLessonSchema,
  flowAnalysisSchema,
  flowQuestionSchema,
  validationResultSchema,
} from "./schemas";
import { createTogetherClient, DEFAULT_MODEL } from "./utils/together";
import { parseJSON } from "./utils/json";

export interface LessonProgressCallback {
  (type: string, message: string, data?: any): void;
}

export interface CreateLessonsInput {
  module: Module;
  content: string;
  apiKey: string;
  model?: string;
  validateStructure?: boolean; // Kept for API compat — Zod now handles this
  validateContent?: boolean;
  retryFailures?: boolean;
  maxRetries?: number;
  onProgress?: LessonProgressCallback;
  /** Questions already generated in previous modules — avoid duplicating these */
  previousQuestions?: string[];
  /** All module titles in the course — helps focus questions on this module's scope */
  allModuleTitles?: string[];
}

export interface ValidateLessonInput {
  lesson: Lesson;
  moduleTitle: string;
  content: string;
  apiKey: string;
  model?: string;
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
  model = DEFAULT_MODEL,
  validateContent = true,
  onProgress,
  previousQuestions = [],
  allModuleTitles = [],
}: CreateLessonsInput): Promise<ModuleWithLessons> {
  onProgress?.("lesson-start", `Generating lessons for "${module.title}"...`);
  const together = createTogetherClient(apiKey);

  // Build deduplication context for the prompt
  const moduleContext = allModuleTitles.length > 0
    ? `\nThis course has ${allModuleTitles.length} modules:\n${allModuleTitles.map((t, i) => `${i + 1}. "${t}"`).join("\n")}\nYou are generating lessons ONLY for module "${module.title}". Focus your questions on topics and facts unique to this module's scope. Do NOT cover topics that belong to the other modules.\n`
    : "";

  const dedupContext = previousQuestions.length > 0
    ? `\nIMPORTANT — AVOID DUPLICATE QUESTIONS: The following questions have already been used in other modules of this course. You MUST NOT ask the same or similar questions. Each question must test a DIFFERENT fact or concept.\nAlready used:\n${previousQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}\n`
    : "";

  const standardLessonPrompt = `Analyse the following content and create 3 lessons for the module "${module.title}".
Respond ONLY with a JSON object. No other text.
${moduleContext}${dedupContext}
You must create exactly ONE lesson for EACH question type:
1. "short-answer" - answer is a text string. The answer must be a fact EXPLICITLY stated in the source content. Do NOT ask about exact URLs, code snippets, or strings that may have formatting issues. Do NOT embed unverified claims or translations in the question itself — only state facts from the source.
2. "true-false" - answer is true or false (boolean). The statement MUST be clearly and unambiguously true or false based solely on the source content. Avoid nuanced, debatable, or misleading phrasing. Do NOT use double negatives. Do NOT paraphrase the source in a way that subtly changes meaning.
3. "multiple-choice" - answer is index 0-3, must include 4 choices

Return this exact JSON structure:
{
  "lessons": [
    {
      "title": "Lesson Title",
      "content": "Lesson content, about 3 sentences long.",
      "info": "A quick one sentence key fact",
      "question": "A question to test understanding",
      "questionType": "short-answer",
      "answer": "The answer text"
    },
    {
      "title": "Lesson Title",
      "content": "Lesson content, about 3 sentences long.",
      "info": "A quick one sentence key fact",
      "question": "A true or false statement",
      "questionType": "true-false",
      "answer": true
    },
    {
      "title": "Lesson Title",
      "content": "Lesson content, about 3 sentences long.",
      "info": "A quick one sentence key fact",
      "question": "A multiple choice question",
      "questionType": "multiple-choice",
      "answer": 1,
      "choices": ["Option A", "Option B (correct)", "Option C", "Option D"],
      "explanation": "Why the correct answer is right"
    }
  ]
}

For numeric questions, choices can be numbers: [88.3, 91.7, 92.7, 95.0]

Content:
${content}`;

  // Start both standard lesson generation and flow generation concurrently
  const standardLessonsPromise = generateText({
    model: together(model),
    prompt: standardLessonPrompt,
  });

  const flowGenerationPromise = generateFlowDiagram({
    moduleTitle: module.title,
    content,
    apiKey,
    model,
  });

  // Wait for both to complete
  const [result, flowResult] = await Promise.all([
    standardLessonsPromise,
    flowGenerationPromise,
  ]);

  // Start flow question generation early
  const flowQuestionPromise =
    flowResult?.hasFlow && flowResult.flowConfig
      ? generateFlowQuestion({
          flowConfig: flowResult.flowConfig,
          moduleTitle: module.title,
          content,
          apiKey,
          model,
        })
      : Promise.resolve(null);

  // Parse JSON and validate with Zod, retrying on structural failures (truncation, wrong types)
  const maxStructureRetries = 3;
  let validated = standardLessonsSchema.safeParse(parseJSON(result.text));

  for (let attempt = 1; attempt <= maxStructureRetries && !validated.success; attempt++) {
    const issues = validated.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
    console.warn(`  ⚠️  Zod validation failed for "${module.title}" (attempt ${attempt}/${maxStructureRetries}): ${issues}`);

    const retryResult = await generateText({
      model: together(model),
      prompt: standardLessonPrompt,
    });
    validated = standardLessonsSchema.safeParse(parseJSON(retryResult.text));
  }

  if (!validated.success) {
    console.error("Zod validation failed for module:", module.title);
    console.error("Issues:", validated.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", "));
    throw new Error(`Structured output validation failed after ${maxStructureRetries} retries: ${validated.error.issues.map(i => i.message).join(", ")}`);
  }

  // Track failures by lesson index
  const failuresByIndex = new Map<number, FailedLesson>();
  const lessons: any[] = validated.data.lessons.map((lesson) => ({ ...lesson }));

  // Run LLM-based content validation if requested (concurrently)
  if (validateContent) {
    const validationPromises = lessons.map(async (lesson: any, i: number) => {
      try {
        const validation = await validateLesson({
          lesson,
          moduleTitle: module.title,
          content,
          apiKey,
          model,
        });
        return { index: i, lesson, validation };
      } catch (error: any) {
        if (RetryError.isInstance(error) || APICallError.isInstance(error)) {
          console.warn(`  ⚠️  Lesson "${lesson.title}" validation temporarily unavailable - skipping`);
          return { index: i, lesson, validation: null };
        }
        console.warn(`  ⚠️  Lesson "${lesson.title}" validation error - skipping`);
        return { index: i, lesson, validation: null };
      }
    });

    const validationResults = await Promise.all(validationPromises);

    for (const { index, lesson, validation } of validationResults) {
      if (!validation) continue;
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
          error: { validationType: "content", reason: validation.explanation, details },
        });
        console.error(`  ❌ Lesson "${lesson.title}" failed content validation: ${validation.explanation}`);
      }
    }
  }

  // Get flow lesson (was started earlier in parallel)
  const flowLesson = await flowQuestionPromise;

  if (flowLesson) {
    if (validateContent) {
      try {
        const validation = await validateLesson({
          lesson: flowLesson,
          moduleTitle: module.title,
          content,
          apiKey,
          model,
        });
        if (validation.isValid) {
          lessons.push(flowLesson);
        } else {
          console.error(`  ❌ Flow lesson "${flowLesson.title}" failed validation`);
          const flowIndex = lessons.length;
          failuresByIndex.set(flowIndex, {
            success: false,
            data: flowLesson,
            error: { validationType: "content", reason: validation.explanation, details: [validation.explanation] },
          });
          lessons.push(flowLesson);
        }
      } catch {
        lessons.push(flowLesson);
      }
    } else {
      lessons.push(flowLesson);
    }
  }

  // Retry failed lessons (simple single-pass regeneration)
  if (failuresByIndex.size > 0) {
    const fixPromises = Array.from(failuresByIndex.entries()).map(
      async ([index, failed]) => {
        try {
          const fixResult = await generateText({
            model: together(model),
            prompt: `Fix this lesson that failed validation. The problem was:
${failed.error.reason}
${failed.error.details?.join("\n") || ""}

Module: "${module.title}"
Original lesson: ${JSON.stringify(failed.data, null, 2)}

Source content:
${content}

Generate a corrected version. Respond ONLY with JSON matching this structure:
${failed.data.questionType === "short-answer" ? '{"title":"...","content":"...","info":"...","question":"...","questionType":"short-answer","answer":"..."}' : ""}
${failed.data.questionType === "true-false" ? '{"title":"...","content":"...","info":"...","question":"...","questionType":"true-false","answer":true}' : ""}
${failed.data.questionType === "multiple-choice" ? '{"title":"...","content":"...","info":"...","question":"...","questionType":"multiple-choice","answer":1,"choices":["A","B","C","D"],"explanation":"..."}' : ""}`,
          });
          const parsed = parseJSON(fixResult.text);
          const revalidated = singleLessonSchema.safeParse(parsed);
          if (revalidated.success) {
            lessons[index] = { ...revalidated.data };
            failuresByIndex.delete(index);
          }
        } catch {
          // Fix failed — keep original failure
        }
      }
    );
    await Promise.all(fixPromises);
  }

  // Build final results
  const lessonResults: LessonResult[] = lessons.map((lesson: any, index: number) => {
    const failure = failuresByIndex.get(index);
    return failure || { success: true, data: lesson };
  });

  const moduleResult = { title: module.title, lessons: lessonResults };
  const successfulCount = lessonResults.filter((r) => r.success).length;

  onProgress?.(
    "lesson-complete",
    `Completed "${module.title}" (${successfulCount}/${lessonResults.length} lessons)`,
    { moduleTitle: module.title, successful: successfulCount, total: lessonResults.length }
  );

  return moduleResult;
}

/**
 * Analyzes module content for flow/process diagrams.
 */
async function generateFlowDiagram({
  moduleTitle,
  content,
  apiKey,
  model = DEFAULT_MODEL,
}: {
  moduleTitle: string;
  content: string;
  apiKey: string;
  model?: string;
}): Promise<{ hasFlow: boolean; flowConfig?: FlowConfig } | null> {
  const together = createTogetherClient(apiKey);

  try {
    const result = await generateText({
      model: together(model),
      prompt: `Analyze the following content for the module "${moduleTitle}".
Determine if this content describes a PROCESS, SYSTEM, or SEQUENTIAL FLOW suitable for a flow diagram.

Good candidates: step-by-step processes, system architectures, cause-and-effect chains, workflows, state transitions.

Respond ONLY with JSON. No other text.

If suitable:
{
  "hasFlow": true,
  "nodes": [
    {"id": "step-1", "label": "First Step", "type": "start"},
    {"id": "step-2", "label": "Process Step", "type": "process"},
    {"id": "step-3", "label": "Final Output", "type": "output"}
  ],
  "edges": [["step-1", "step-2"], ["step-2", "step-3"]]
}

If NOT suitable:
{"hasFlow": false, "nodes": [], "edges": []}

Node types: "start" (1 only), "process" (steps), "output" (terminal).
Keep labels concise (2-5 words). Use 4-8 nodes. Each id must be unique.

Content:
${content}`,
    });

    const parsed = parseJSON(result.text);
    const validated = flowAnalysisSchema.safeParse(parsed);

    if (!validated.success) {
      return { hasFlow: false };
    }

    const { hasFlow, nodes, edges } = validated.data;
    if (!hasFlow || nodes.length === 0) {
      return { hasFlow: false };
    }

    return {
      hasFlow: true,
      flowConfig: {
        nodes: nodes.map((n) => ({ id: n.id, label: n.label, type: n.type })),
        edges: edges as SimpleEdge[],
      },
    };
  } catch (error) {
    console.error(`  ❌ Error generating flow diagram for "${moduleTitle}":`, error);
    return { hasFlow: false };
  }
}

/**
 * Generates a drag-drop ordering question from a flow diagram.
 */
async function generateFlowQuestion({
  flowConfig,
  moduleTitle,
  content,
  apiKey,
  model = DEFAULT_MODEL,
}: {
  flowConfig: FlowConfig;
  moduleTitle: string;
  content: string;
  apiKey: string;
  model?: string;
}): Promise<FlowDiagramLesson | null> {
  const together = createTogetherClient(apiKey);
  const nodeLabels = flowConfig.nodes.map((n) => n.label);

  try {
    const result = await generateText({
      model: together(model),
      prompt: `Given this flow diagram for the module "${moduleTitle}", create a drag-and-drop ordering question.

Flow nodes: ${nodeLabels.map((l, i) => `${i + 1}. ${l}`).join(", ")}

Respond ONLY with JSON:
{
  "title": "Lesson Title",
  "content": "Brief 2-3 sentence explanation of the process",
  "info": "One key fact about this process",
  "question": "What is the correct order of steps in [specific process name]?",
  "choices": ["Step A", "Step B", "Step C"],
  "slots": ["First", "Second", "Third"],
  "answer": [0, 2, 1]
}

Rules:
- Select 3 important sequential nodes from the flow
- Choices = actual node labels from the flow
- Slots = "First", "Second", "Third"
- Answer = array of 3 indices (0-2) mapping slot→choice. [0,2,1] means First→choice0, Second→choice2, Third→choice1
- The question MUST be specific to this process — mention the actual process or topic by name. Do NOT use generic phrasing like "Put the following steps in the correct order"

Source content:
${content}`,
    });

    const parsed = parseJSON(result.text);
    const validated = flowQuestionSchema.safeParse(parsed);

    if (!validated.success) {
      console.error(`  ❌ Flow question validation failed:`, validated.error.issues.map(i => i.message).join(", "));
      return null;
    }

    const q = validated.data;
    if (new Set(q.answer).size !== 3) {
      console.error(`  ❌ Invalid flow answer: not a permutation`);
      return null;
    }

    return {
      title: q.title,
      content: q.content,
      info: q.info,
      question: q.question,
      questionType: QuestionType.FlowDiagram,
      flowConfig,
      choices: q.choices,
      slots: q.slots,
      answer: q.answer,
    };
  } catch (error) {
    console.error(`  ❌ Error generating flow question for "${moduleTitle}":`, error);
    return null;
  }
}

export async function validateLesson({
  lesson,
  moduleTitle,
  content,
  apiKey,
  model = DEFAULT_MODEL,
}: ValidateLessonInput): Promise<ValidationResult> {
  const together = createTogetherClient(apiKey);

  const lessonData = {
    title: lesson.title,
    content: lesson.content,
    info: lesson.info,
    question: lesson.question,
    questionType: lesson.questionType,
    answer: lesson.answer,
    ...(lesson.questionType === QuestionType.MultipleChoice && {
      choices: (lesson as MultipleChoiceLesson).choices,
      explanation: (lesson as MultipleChoiceLesson).explanation,
    }),
    ...(lesson.questionType === QuestionType.FlowDiagram && {
      choices: (lesson as FlowDiagramLesson).choices,
      slots: (lesson as FlowDiagramLesson).slots,
      flowConfig: (lesson as FlowDiagramLesson).flowConfig,
    }),
  };

  const result = await generateText({
    model: together(model),
    prompt: `You are a lesson quality validator. Validate the following lesson against the source content.
Respond ONLY with JSON. No other text.

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

Return:
{"isValid": true, "explanation": "Brief assessment"}

Or if issues found:
{"isValid": false, "explanation": "Brief assessment", "issues": {"content": "issue", "answer": "issue"}}

Only include specific issue fields that have problems.`,
  });

  try {
    const parsed = parseJSON(result.text);
    const validated = validationResultSchema.safeParse(parsed);

    if (!validated.success) {
      return { isValid: false, explanation: "Failed to validate - invalid response format" };
    }

    return {
      isValid: validated.data.isValid,
      explanation: validated.data.explanation,
      issues: validated.data.issues,
    };
  } catch {
    console.error("Failed to parse validation response:", result.text.substring(0, 200));
    return { isValid: false, explanation: "Failed to validate lesson - invalid response format" };
  }
}
