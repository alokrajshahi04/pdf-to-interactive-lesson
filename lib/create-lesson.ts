import { generateText } from "ai";
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
  console.log(`\n📚 Starting lesson generation for module: "${module.title}"`);
  onProgress?.("lesson-start", `Generating lessons for "${module.title}"...`);
  const together = createTogetherClient(apiKey);
  
  console.log(`🤖 Requesting LLM to generate 3 lessons (one per question type)...`);
  const generationStartTime = Date.now();
  
  // Start both standard lesson generation and flow generation concurrently
  const standardLessonsPromise = generateText({
    model: together(DEFAULT_MODEL),
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
  });

  // Wait for both to complete
  const [result, flowResult] = await Promise.all([
    standardLessonsPromise,
    flowGenerationPromise,
  ]);

  const generationTime = ((Date.now() - generationStartTime) / 1000).toFixed(2);
  console.log(`✅ LLM responses received in ${generationTime}s`);

  const parser = createXMLParser(["lesson", "choice", "slot"]);

  try {
    console.log(`🔍 Parsing XML structure...`);
    const lessonStructure = parser.parse(result.text);
    const lessonCount = lessonStructure.module?.lessons?.length || lessonStructure.module?.lesson?.length || 0;
    console.log(`✅ Parsed ${lessonCount} lesson(s) from XML`);

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
      console.log(`\n🔍 Running structure validation for ${lessonStructure.module.lessons.length} lesson(s)...`);
      const validationStartTime = Date.now();
      const validationResult = validateLessonsStructure(
        lessonStructure.module.lessons
      );
      const validationTime = ((Date.now() - validationStartTime) / 1000).toFixed(2);

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
        console.log(`❌ Found ${errors.length} structure error(s) (validated in ${validationTime}s)`);
        
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
      } else {
        console.log(`✅ All lessons passed structure validation (${validationTime}s)`);
      }
    }

    // Run LLM-based content validation if requested (concurrently)
    if (validateContent && lessonStructure.module?.lessons) {
      const lessonsToValidate = lessonStructure.module.lessons.filter(
        (_: any, i: number) => !failuresByIndex.has(i)
      );
      console.log(
        `\n🔍 Validating lesson content for module "${module.title}" (${lessonsToValidate.length} lesson(s) to validate)...`
      );

      // Validate all lessons concurrently
      const validationStartTime = Date.now();
      const validationPromises = lessonStructure.module.lessons.map(
        async (lesson: any, i: number) => {
          // Skip if already failed structure validation
          if (failuresByIndex.has(i)) {
            return { index: i, lesson, validation: null };
          }

          console.log(`  🔍 Validating lesson "${lesson.title}"...`);
          const lessonValidationStart = Date.now();
          const validation = await validateLesson({
            lesson,
            moduleTitle: module.title,
            content,
            apiKey,
          });
          const lessonValidationTime = ((Date.now() - lessonValidationStart) / 1000).toFixed(2);
          
          if (validation.isValid) {
            console.log(`  ✅ Lesson "${lesson.title}" passed content validation (${lessonValidationTime}s)`);
          } else {
            console.log(`  ❌ Lesson "${lesson.title}" failed content validation (${lessonValidationTime}s)`);
          }

          return { index: i, lesson, validation };
        }
      );

      const validationResults = await Promise.all(validationPromises);
      const totalValidationTime = ((Date.now() - validationStartTime) / 1000).toFixed(2);
      console.log(`✅ Content validation completed in ${totalValidationTime}s`);

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

      // Log which lessons need fixing
      failuresByIndex.forEach((failedLesson, index) => {
        const lessonTitle = failedLesson.data?.title || `Lesson ${index + 1}`;
        console.log(`  🔧 Will fix lesson "${lessonTitle}" (${failedLesson.error.validationType} validation failed)`);
      });

      // Fix all failed lessons concurrently
      const fixStartTime = Date.now();
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
      const fixTime = ((Date.now() - fixStartTime) / 1000).toFixed(2);
      console.log(`✅ Fix attempts completed in ${fixTime}s`);

      // Process fix results
      for (const { index, fixResult } of fixResults) {
        if (fixResult.success && fixResult.lesson) {
          // Replace the lesson at this index with the fixed version
          lessonStructure.module.lessons[index] = fixResult.lesson;
          // Remove from failures map (it's now successful)
          failuresByIndex.delete(index);
          console.log(
            `  ✅ Fixed lesson "${fixResult.lesson.title}" after ${fixResult.attempts} attempt(s)`
          );
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

    // Generate flow-based lesson if a flow diagram was detected
    if (flowResult?.hasFlow && flowResult.flowConfig) {
      console.log(`\n🌊 Flow diagram detected - generating flow-based lesson...`);
      const flowLessonStartTime = Date.now();
      
      const flowLesson = await generateFlowQuestion({
        flowConfig: flowResult.flowConfig,
        moduleTitle: module.title,
        content,
        apiKey,
      });

      if (flowLesson) {
        // Validate flow lesson if content validation is enabled
        if (validateContent) {
          console.log(`  🔍 Validating flow lesson "${flowLesson.title}"...`);
          const flowValidationStart = Date.now();
          const validation = await validateLesson({
            lesson: flowLesson,
            moduleTitle: module.title,
            content,
            apiKey,
          });
          const flowValidationTime = ((Date.now() - flowValidationStart) / 1000).toFixed(2);

          if (validation.isValid) {
            console.log(`  ✅ Flow lesson passed validation (${flowValidationTime}s)`);
            lessonStructure.module.lessons.push(flowLesson);
          } else {
            console.log(`  ❌ Flow lesson failed validation (${flowValidationTime}s)`);
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
              console.log(`\n🔧 Attempting to fix flow lesson "${flowLesson.title}"...`);
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
                maxRetries,
              });

              if (fixResult.success && fixResult.lesson) {
                console.log(`  ✅ Fixed flow lesson "${flowLesson.title}" after ${fixResult.attempts} attempt(s)`);
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
        } else {
          // No validation - add directly
          lessonStructure.module.lessons.push(flowLesson);
        }

        const flowLessonTime = ((Date.now() - flowLessonStartTime) / 1000).toFixed(2);
        console.log(`✅ Flow-based lesson completed in ${flowLessonTime}s`);
      } else {
        console.log(`  ❌ Failed to generate flow-based lesson`);
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
    const failedCount = lessonResults.length - successfulCount;
    
    console.log(`\n📊 Module "${module.title}" summary:`);
    console.log(`   ✅ Successful: ${successfulCount}/${lessonResults.length}`);
    if (failedCount > 0) {
      console.log(`   ❌ Failed: ${failedCount}/${lessonResults.length}`);
    }
    
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
}: {
  moduleTitle: string;
  content: string;
  apiKey: string;
}): Promise<{ hasFlow: boolean; flowConfig?: FlowConfig } | null> {
  const together = createTogetherClient(apiKey);
  
  console.log(`  🔍 Analyzing if "${moduleTitle}" contains a process/flow diagram...`);
  const flowStartTime = Date.now();
  
  try {
    const result = await generateText({
      model: together(DEFAULT_MODEL),
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
      console.log(`  ℹ️  No flow structure detected for "${moduleTitle}"`);
      return { hasFlow: false };
    }

    const hasFlow = flowStructure.flow.hasFlow === "true" || flowStructure.flow.hasFlow === true;
    
    if (!hasFlow) {
      const flowTime = ((Date.now() - flowStartTime) / 1000).toFixed(2);
      console.log(`  ❌ No suitable flow found for "${moduleTitle}" (${flowTime}s)`);
      return { hasFlow: false };
    }

    // Convert XML structure to FlowConfig format
    const nodes = flowStructure.flow.nodes?.node || flowStructure.flow.node || [];
    const edges = flowStructure.flow.edges?.edge || flowStructure.flow.edge || [];

    if (!Array.isArray(nodes) || nodes.length === 0) {
      console.log(`  ❌ Invalid flow structure (no nodes) for "${moduleTitle}"`);
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

    const flowTime = ((Date.now() - flowStartTime) / 1000).toFixed(2);
    console.log(`  ✅ Flow diagram generated for "${moduleTitle}" with ${flowConfig.nodes.length} nodes (${flowTime}s)`);

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
}: {
  flowConfig: FlowConfig;
  moduleTitle: string;
  content: string;
  apiKey: string;
}): Promise<FlowDiagramLesson | null> {
  const together = createTogetherClient(apiKey);
  
  console.log(`  🎯 Generating flow-based question for "${moduleTitle}"...`);
  const questionStartTime = Date.now();
  
  // Extract key nodes for the question (will select 3 sequential nodes)
  const nodeLabels = flowConfig.nodes.map(n => n.label);
  
  try {
    const result = await generateText({
      model: together(DEFAULT_MODEL),
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

    const lesson = lessonStructure.flowLesson;

    // Flatten choices and slots
    let choices = lesson.choices?.choice || lesson.choice || [];
    let slots = lesson.slots?.slot || lesson.slot || [];

    // Parse answer array
    let answer: number[];
    if (typeof lesson.answer === "string") {
      answer = lesson.answer.split(",").map((val: string) => parseInt(val.trim(), 10));
    } else if (Array.isArray(lesson.answer)) {
      answer = lesson.answer.map((val: any) => parseInt(val, 10));
    } else {
      console.error(`  ❌ Invalid answer format for flow question`);
      return null;
    }

    // Truncate to exactly 3 items if more were provided (forgiving approach)
    if (choices.length > 3) {
      console.log(`  ⚠️  LLM generated ${choices.length} choices, truncating to first 3`);
      choices = choices.slice(0, 3);
    }
    if (slots.length > 3) {
      console.log(`  ⚠️  LLM generated ${slots.length} slots, truncating to first 3`);
      slots = slots.slice(0, 3);
    }
    if (answer.length > 3) {
      console.log(`  ⚠️  LLM generated ${answer.length} answer elements, truncating to first 3`);
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

    const questionTime = ((Date.now() - questionStartTime) / 1000).toFixed(2);
    console.log(`  ✅ Flow question generated for "${moduleTitle}" (${questionTime}s)`);

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
    ...(lesson.questionType === QuestionType.FlowDiagram && {
      choices: (lesson as FlowDiagramLesson).choices,
      slots: (lesson as FlowDiagramLesson).slots,
      flowConfig: (lesson as FlowDiagramLesson).flowConfig,
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
5. CHOICES (if flow-diagram): Are the 3 choices actual steps from the flow? Do they test understanding of the sequence?
6. SLOTS (if flow-diagram): Are there exactly 3 slots (First, Second, Third)?
7. ANSWER (if flow-diagram): Does the answer array correctly map the sequence of the 3 chosen steps?
8. INFO: Does the highlighted info fact come from the lesson content?

Respond ONLY with valid JSON in this exact format:
{
  "isValid": true or false,
  "explanation": "Brief overall assessment",
  "issues": {
    "content": "Issue with content (if any)",
    "question": "Issue with question (if any)",
    "answer": "Issue with answer (if any)",
    "choices": "Issue with choices (if any)",
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
