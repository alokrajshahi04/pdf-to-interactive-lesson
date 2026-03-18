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
import { createXMLParser, extractJson, postProcessLesson } from "./utils/xml";
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
  model?: string; // Model to use for generation (default: DEFAULT_MODEL)
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
  validateStructure = true,
  validateContent = true,
  retryFailures = true,
  maxRetries = 3,
  onProgress,
}: CreateLessonsInput): Promise<ModuleWithLessons> {
  onProgress?.("lesson-start", `Generating lessons for "${module.title}"...`);
  const together = createTogetherClient(apiKey);
  
  // Start both standard lesson generation and flow generation concurrently
  const standardLessonsPromise = generateText({
    model: together(model),
    prompt: `Analyse the following content and create 3 lessons for the module "${module.title}".
Respond only with XML format. Do not include any other text.

IMPORTANT: You must create exactly ONE lesson for EACH of these question types:
1. "short-answer" - For open-ended text questions (answer is text)
2. "true-false" - For true/false questions (answer must be "true" or "false")
3. "multiple-choice" - For multiple choice questions (answer is index 0-3, must include <choices>)

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
    <explanation>A brief explanation of why the correct answer is right (1-2 sentences)</explanation>
  </lesson>
</module>

Note: For numeric questions (years, scores, percentages, etc.), choices can be numbers:
  <choices>
    <choice>88.3</choice>
    <choice>91.7</choice>
    <choice>92.7</choice>
  </choices>

Content:
${content}`,
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

  // Start flow question generation early (doesn't depend on standard lesson processing)
  const flowQuestionPromise = flowResult?.hasFlow && flowResult.flowConfig
    ? generateFlowQuestion({
        flowConfig: flowResult.flowConfig,
        moduleTitle: module.title,
        content,
        apiKey,
        model,
      })
    : Promise.resolve(null);

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
      lessonStructure.module.lessons = lessonStructure.module.lessons.map(postProcessLesson);
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

        // Mark lessons as failed and log details
        errorsByLesson.forEach((details, index) => {
          const lesson = lessonStructure.module.lessons[index];
          const lessonTitle = lesson?.title || `Lesson ${index + 1}`;
          console.error(`  ❌ Lesson "${lessonTitle}" failed structure validation:`);
          details.forEach((detail) => {
            console.error(`     - ${detail}`);
          });
          
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
      }
    }

    // Run LLM-based content validation if requested (concurrently)
    if (validateContent && lessonStructure.module?.lessons) {
      // Validate all lessons concurrently
      const validationPromises = lessonStructure.module.lessons.map(
        async (lesson: any, i: number) => {
          // Skip if already failed structure validation
          if (failuresByIndex.has(i)) {
            return { index: i, lesson, validation: null };
          }
          
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
            // Handle AI SDK errors intelligently
            if (RetryError.isInstance(error)) {
              const lastError = error.lastError;
              if (APICallError.isInstance(lastError) && lastError.isRetryable) {
                // Temporary service issue (503, 429, etc.) - already exhausted retries
                console.warn(`  ⚠️  Lesson "${lesson.title}" validation temporarily unavailable - skipping validation`);
                console.warn(`     Reason: ${lastError.message} (retries exhausted)`);
                return { index: i, lesson, validation: null };
              }
            }
            
            if (APICallError.isInstance(error)) {
              if (error.isRetryable) {
                // Retryable error without retry wrapper
                console.warn(`  ⚠️  Lesson "${lesson.title}" validation temporarily failed - skipping validation`);
                console.warn(`     Reason: ${error.message} (retryable)`);
                return { index: i, lesson, validation: null };
              } else {
                // Non-retryable error (config issue, invalid params, etc.)
                console.error(`  ❌ Lesson "${lesson.title}" validation failed with non-retryable error`);
                console.error(`     Error: ${error.message}`);
                console.error(`     This may indicate a configuration or API key issue`);
                return { index: i, lesson, validation: null };
              }
            }
            
            // Unknown error type
            console.warn(`  ⚠️  Lesson "${lesson.title}" validation error - skipping validation`);
            console.warn(`     Error: ${error.message || 'Unknown error'}`);
            return { index: i, lesson, validation: null };
          }
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
              reason: validation.explanation,
              details,
            },
          });

          console.error(`  ❌ Lesson "${lesson.title}" failed content validation:`);
          console.error(`     Reason: ${validation.explanation}`);
          if (validation.issues) {
            Object.entries(validation.issues).forEach(([field, issue]) => {
              console.error(`     - [${field}] ${issue}`);
            });
          }
        } else {
          // Log warnings for lessons that passed but have concerns
          if (validation.issues) {
            console.warn(`  ⚠️  Lesson "${lesson.title}" has minor issues:`);
            Object.entries(validation.issues).forEach(([field, issue]) => {
              console.warn(`     - [${field}] ${issue}`);
            });
          }
        }
      }
    }

    // Attempt to fix failed lessons if requested (concurrently)
    if (retryFailures && failuresByIndex.size > 0) {
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
            model,
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
        } else if (fixResult.failure) {
          const lessonTitle = fixResult.failure.lesson?.title || `Lesson ${index + 1}`;
          console.error(
            `  ❌ Failed to fix lesson "${lessonTitle}" after ${fixResult.attempts} attempt(s)`
          );
          console.error(`     Reason: ${fixResult.failure.reason}`);
          if (fixResult.failure.details && fixResult.failure.details.length > 0) {
            console.error(`     Details:`);
            fixResult.failure.details.forEach((detail) => {
              console.error(`       - ${detail}`);
            });
          }
          
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
    }

    // Get flow lesson (was started earlier in parallel with standard lesson processing)
    const flowLesson = await flowQuestionPromise;
    
    if (flowLesson) {
        // Validate flow lesson if content validation is enabled
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
              lessonStructure.module.lessons.push(flowLesson);
            } else {
              console.error(`  ❌ Flow lesson "${flowLesson.title}" failed validation`);
              console.error(`     Reason: ${validation.explanation}`);
              
              // Build detailed failure information
              const details: string[] = [validation.explanation];
              if (validation.issues) {
                Object.entries(validation.issues).forEach(([field, issue]) => {
                  console.error(`     - [${field}] ${issue}`);
                  details.push(`[${field}] ${issue}`);
                });
              }
              
              // Attempt to fix the flow lesson if retry is enabled
              if (retryFailures) {
                const fixResult = await fixLesson({
                  failure: {
                    lesson: flowLesson,
                    validationType: "content",
                    reason: validation.explanation,
                    details,
                  },
                  moduleTitle: module.title,
                  content,
                  apiKey,
                  model,
                  maxRetries,
                });

                if (fixResult.success && fixResult.lesson) {
                  lessonStructure.module.lessons.push(fixResult.lesson);
                } else {
                  // Failed to fix
                  const flowIndex = lessonStructure.module.lessons.length;
                  failuresByIndex.set(flowIndex, {
                    success: false,
                    data: flowLesson,
                    error: fixResult.failure || {
                      validationType: "content",
                      reason: validation.explanation,
                      details,
                    },
                  });
                  lessonStructure.module.lessons.push(flowLesson); // Add it anyway for tracking
                }
              } else {
                // No retry - mark as failed
                const flowIndex = lessonStructure.module.lessons.length;
                failuresByIndex.set(flowIndex, {
                  success: false,
                  data: flowLesson,
                  error: {
                    validationType: "content",
                    reason: validation.explanation,
                    details,
                  },
                });
                lessonStructure.module.lessons.push(flowLesson); // Add it anyway for tracking
              }
            }
          } catch (error: any) {
            // Handle AI SDK errors intelligently
            if (RetryError.isInstance(error)) {
              const lastError = error.lastError;
              if (APICallError.isInstance(lastError) && lastError.isRetryable) {
                // Temporary service issue (503, 429, etc.) - already exhausted retries
                console.warn(`  ⚠️  Flow lesson "${flowLesson.title}" validation temporarily unavailable - skipping validation`);
                console.warn(`     Reason: ${lastError.message} (retries exhausted)`);
                lessonStructure.module.lessons.push(flowLesson);
              }
            } else if (APICallError.isInstance(error)) {
              if (error.isRetryable) {
                // Retryable error without retry wrapper
                console.warn(`  ⚠️  Flow lesson "${flowLesson.title}" validation temporarily failed - skipping validation`);
                console.warn(`     Reason: ${error.message} (retryable)`);
                lessonStructure.module.lessons.push(flowLesson);
              } else {
                // Non-retryable error (config issue, invalid params, etc.)
                console.error(`  ❌ Flow lesson "${flowLesson.title}" validation failed with non-retryable error`);
                console.error(`     Error: ${error.message}`);
                console.error(`     This may indicate a configuration or API key issue`);
                lessonStructure.module.lessons.push(flowLesson);
              }
            } else {
              // Unknown error type
              console.warn(`  ⚠️  Flow lesson "${flowLesson.title}" validation error - skipping validation`);
              console.warn(`     Error: ${error.message || 'Unknown error'}`);
              lessonStructure.module.lessons.push(flowLesson);
            }
          }
        } else {
          // No validation - add directly
          lessonStructure.module.lessons.push(flowLesson);
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

/**
 * Analyzes module content to determine if it contains a flow/process diagram,
 * and generates the flow structure if suitable.
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

Determine if this content describes a PROCESS, SYSTEM, or SEQUENTIAL FLOW that would benefit from a visual flow diagram.

Good candidates include:
- Step-by-step processes (e.g., photosynthesis, authentication flow)
- System architectures (e.g., client-server, data pipelines)
- Cause-and-effect chains
- Sequential workflows
- State transitions

If suitable, generate a flow diagram. If NOT suitable, respond with hasFlow="false".

Respond ONLY with XML in this exact format:

<flow hasFlow="true">
  <nodes>
    <node id="step-1" label="First Step" type="start" />
    <node id="step-2" label="Process Step" type="process" />
    <node id="step-3" label="Another Process" type="process" />
    <node id="step-4" label="Final Output" type="output" />
  </nodes>
  <edges>
    <edge source="step-1" target="step-2" />
    <edge source="step-2" target="step-3" />
    <edge source="step-3" target="step-4" />
  </edges>
</flow>

OR if not suitable:

<flow hasFlow="false" />

Node type rules:
- "start" - Initial trigger/input (use for 1 node only)
- "process" - Processing steps, transformations
- "output" - Final results, outputs (use for terminal nodes)

Keep node labels concise (2-5 words). Use 4-8 nodes total. Each node id must be unique.

Content:
${content}`,
    });

    // Parse the XML response
    const parser = createXMLParser(["node", "edge"]);
    const flowStructure = parser.parse(result.text);

    if (!flowStructure.flow) {
      return { hasFlow: false };
    }

    const hasFlow = flowStructure.flow.hasFlow === "true" || flowStructure.flow.hasFlow === true;
    
    if (!hasFlow) {
      return { hasFlow: false };
    }

    // Convert XML structure to FlowConfig format
    const nodes = flowStructure.flow.nodes?.node || flowStructure.flow.node || [];
    const edges = flowStructure.flow.edges?.edge || flowStructure.flow.edge || [];

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { hasFlow: false };
    }

    const flowConfig: FlowConfig = {
      nodes: nodes.map((node: any) => ({
        id: node.id,
        label: node.label,
        type: node.type as 'start' | 'process' | 'output',
      })),
      edges: edges.map((edge: any) => [edge.source, edge.target] as SimpleEdge),
    };

    return {
      hasFlow: true,
      flowConfig,
    };
  } catch (error) {
    console.error(`  ❌ Error generating flow diagram for "${moduleTitle}":`, error);
    return { hasFlow: false };
  }
}

/**
 * Generates a drag-drop ordering question based on a flow diagram.
 * Tests the user's understanding of the sequence/order of steps in the flow.
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
  
  // Extract key nodes for the question (will select 3 sequential nodes)
  const nodeLabels = flowConfig.nodes.map(n => n.label);
  
  try {
    const result = await generateText({
      model: together(model),
      prompt: `Given this flow diagram for the module "${moduleTitle}", create a drag-and-drop ordering question.

Flow nodes in the diagram:
${nodeLabels.map((label, i) => `${i + 1}. ${label}`).join('\n')}

Create a question that tests understanding of the CORRECT ORDER/SEQUENCE of 3 key steps from this flow.

Respond ONLY with XML in this exact format:

<flowLesson title="Lesson Title" questionType="flow-diagram">
  <content>Brief 2-3 sentence explanation of this flow process.</content>
  <info>A quick one sentence fact highlighting a key insight about this process</info>
  <question>Put the following steps in the correct order</question>
  <answer>0,2,1</answer>
  <choices>
    <choice>Step A</choice>
    <choice>Step B</choice>
    <choice>Step C</choice>
  </choices>
  <slots>
    <slot>First</slot>
    <slot>Second</slot>
    <slot>Third</slot>
  </slots>
</flowLesson>

Rules:
- Select 3 important sequential nodes from the flow (not all nodes)
- Provide 3 choices and 3 slots (if you provide more, only the first 3 will be used)
- Answer format: comma-separated indices where position = slot, value = choice index
- Example: "0,2,1" means slot 0 gets choice 0, slot 1 gets choice 2, slot 2 gets choice 1
- Choices should be the actual node labels from the flow
- Slots should be ordinal positions: "First", "Second", "Third"
- Content should explain the overall process
- Info should highlight one key fact about the process

Source content:
${content}`,
    });

    // Parse the XML response
    const parser = createXMLParser(["choice", "slot"]);
    const lessonStructure = parser.parse(result.text);

    if (!lessonStructure.flowLesson) {
      console.error(`  ❌ Failed to parse flow question for "${moduleTitle}"`);
      return null;
    }

    const raw = lessonStructure.flowLesson;
    const lesson = postProcessLesson(raw);

    let choices = lesson.choices || [];
    let slots = lesson.slots || [];
    let answer: number[] = lesson.answer;

    if (!Array.isArray(answer)) {
      console.error(`  ❌ Invalid answer format for flow question`);
      return null;
    }

    // Truncate to exactly 3 items if more were provided (forgiving approach)
    if (choices.length > 3) {
      choices = choices.slice(0, 3);
    }
    if (slots.length > 3) {
      slots = slots.slice(0, 3);
    }
    if (answer.length > 3) {
      answer = answer.slice(0, 3);
    }

    // Validate we have at least 3 of each
    if (choices.length < 3) {
      console.error(`  ❌ Not enough choices (need 3, got ${choices.length})`);
      return null;
    }
    if (slots.length < 3) {
      console.error(`  ❌ Not enough slots (need 3, got ${slots.length})`);
      return null;
    }
    if (answer.length < 3) {
      console.error(`  ❌ Not enough answer elements (need 3, got ${answer.length})`);
      return null;
    }

    // Validate answer indices are valid integers within valid range (0-2)
    const invalidIndices = answer.filter(idx => !Number.isInteger(idx) || idx < 0 || idx > 2);
    if (invalidIndices.length > 0) {
      console.error(`  ❌ Invalid answer indices: ${invalidIndices.join(", ")} (must be integers 0-2)`);
      return null;
    }

    const flowLesson: FlowDiagramLesson = {
      title: lesson.title,
      content: lesson.content,
      info: lesson.info,
      question: lesson.question,
      questionType: QuestionType.FlowDiagram,
      flowConfig,
      choices,
      slots,
      answer,
    };

    return flowLesson;
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
5. EXPLANATION (if multiple-choice): Does the explanation clearly explain why the correct answer is right?
6. CHOICES (if flow-diagram): Are the 3 choices actual steps from the flow? Do they test understanding of the sequence?
7. SLOTS (if flow-diagram): Are there exactly 3 slots (First, Second, Third)?
8. ANSWER (if flow-diagram): Does the answer array correctly map the sequence of the 3 chosen steps?
9. INFO: Does the highlighted info fact come from the lesson content?

Respond ONLY with valid JSON in this exact format:
{
  "isValid": true or false,
  "explanation": "Brief overall assessment",
  "issues": {
    "content": "Issue with content (if any)",
    "question": "Issue with question (if any)",
    "answer": "Issue with answer (if any)",
    "choices": "Issue with choices (if any)",
    "explanation": "Issue with explanation (if any, for multiple-choice only)",
    "slots": "Issue with slots (if any)"
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
