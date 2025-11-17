import {
  validateLessonStructure,
  validateLessonsStructure,
  type ValidationError,
} from "./validate-lesson-structure";
import { QuestionType } from "./types";

/**
 * Deterministic tests for lesson structure validation
 * These run instantly without any LLM calls
 *
 * Usage:
 *   bun run lib/validate-lesson-structure.test.ts
 */

function printResult(
  testName: string,
  result: { isValid: boolean; errors: ValidationError[] }
) {
  console.log(`\n${testName}`);
  console.log("-".repeat(60));
  console.log(`Status: ${result.isValid ? "✅ VALID" : "❌ INVALID"}`);

  if (result.errors.length > 0) {
    console.log("\nIssues:");
    result.errors.forEach((error) => {
      const icon = error.severity === "error" ? "❌" : "⚠️ ";
      console.log(`  ${icon} [${error.field}] ${error.message}`);
    });
  } else {
    console.log("✨ No issues found!");
  }
}

function runTests() {
  console.log("🧪 Testing Deterministic Lesson Structure Validation\n");
  console.log("=".repeat(60));

  // Test 1: Valid Multiple Choice Lesson
  printResult(
    "Test 1: Valid Multiple Choice Lesson",
    validateLessonStructure({
      title: "Understanding Self-Attention",
      content: "The Transformer uses self-attention mechanism.",
      info: "Self-attention processes all tokens in parallel.",
      question: "What does self-attention do?",
      answer: 1,
      choices: [
        "Sequential processing",
        "Parallel processing",
        "No processing",
        "Random processing",
      ],
      questionType: QuestionType.MultipleChoice,
    })
  );

  // Test 2: Invalid - Missing choices array
  printResult(
    "Test 2: Multiple Choice without choices array",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: 0,
      questionType: QuestionType.MultipleChoice,
    })
  );

  // Test 3: Invalid - Answer index out of range
  printResult(
    "Test 3: Answer index out of range",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: 5, // Out of range!
      choices: ["A", "B", "C", "D"],
      questionType: QuestionType.MultipleChoice,
    })
  );

  // Test 4: Invalid - Duplicate choices
  printResult(
    "Test 4: Duplicate choices",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: 1,
      choices: ["Same answer", "Same answer", "Different", "Another"],
      questionType: QuestionType.MultipleChoice,
    })
  );

  // Test 5: Valid True/False Lesson
  printResult(
    "Test 5: Valid True/False Lesson",
    validateLessonStructure({
      title: "Transformers use attention",
      content: "The Transformer architecture relies on attention mechanisms.",
      info: "Attention is the core component.",
      question: "Transformers use only attention mechanisms.",
      answer: true,
      questionType: QuestionType.TrueFalse,
    })
  );

  // Test 6: Invalid - True/False with string answer
  printResult(
    "Test 6: True/False with string answer instead of boolean",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: "true", // Should be boolean!
      questionType: QuestionType.TrueFalse,
    })
  );

  // Test 7: Valid Short Answer Lesson
  printResult(
    "Test 7: Valid Short Answer Lesson",
    validateLessonStructure({
      title: "Attention Mechanism",
      content: "The attention mechanism computes relevance scores.",
      info: "Attention uses query-key-value triplets.",
      question: "What does the attention mechanism compute?",
      answer: "Relevance scores between tokens",
      questionType: QuestionType.ShortAnswer,
    })
  );

  // Test 8: Invalid - Missing required fields
  printResult(
    "Test 8: Missing required fields",
    validateLessonStructure({
      title: "Test",
      questionType: QuestionType.ShortAnswer,
      // Missing: content, info, question, answer
    })
  );

  // Test 9: Invalid - Wrong question type
  printResult(
    "Test 9: Invalid question type",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: "Test answer",
      questionType: "invalid-type", // Not a valid QuestionType!
    })
  );

  // Test 10: Warning - Too many choices
  printResult(
    "Test 10: Multiple choice with too many options (warning)",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: 2,
      choices: [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4",
        "Option 5",
        "Option 6",
        "Option 7",
        "Option 8",
      ],
      questionType: QuestionType.MultipleChoice,
    })
  );

  // Test 11: Valid Flow Diagram Lesson
  printResult(
    "Test 11: Valid Flow Diagram Lesson",
    validateLessonStructure({
      title: "Photosynthesis Flow",
      content: "Photosynthesis converts light energy to chemical energy.",
      info: "This process occurs in chloroplasts.",
      question: "Put the following steps in the correct order",
      answer: [0, 2, 1],
      choices: ["Light Capture", "Water Splitting", "Electron Transport"],
      slots: ["First", "Second", "Third"],
      flowConfig: {
        nodes: [
          { id: "n1", label: "Light Capture", type: "start" },
          { id: "n2", label: "Water Splitting", type: "process" },
          { id: "n3", label: "Electron Transport", type: "output" },
        ],
        edges: [
          ["n1", "n2"],
          ["n2", "n3"],
        ],
      },
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 12: Invalid - Flow diagram missing flowConfig
  printResult(
    "Test 12: Flow diagram missing flowConfig",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: [0, 1, 2],
      choices: ["A", "B", "C"],
      slots: ["First", "Second", "Third"],
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 13: Invalid - Flow diagram with wrong number of choices
  printResult(
    "Test 13: Flow diagram with 4 choices (should be 3)",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: [0, 1, 2],
      choices: ["A", "B", "C", "D"], // Should be 3!
      slots: ["First", "Second", "Third"],
      flowConfig: {
        nodes: [
          { id: "n1", label: "Step 1", type: "start" },
          { id: "n2", label: "Step 2", type: "process" },
        ],
        edges: [["n1", "n2"]],
      },
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 14: Invalid - Flow diagram with invalid answer indices
  printResult(
    "Test 14: Flow diagram with invalid answer indices",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: [0, 5, 1], // 5 is out of range!
      choices: ["A", "B", "C"],
      slots: ["First", "Second", "Third"],
      flowConfig: {
        nodes: [
          { id: "n1", label: "Step 1", type: "start" },
          { id: "n2", label: "Step 2", type: "process" },
        ],
        edges: [["n1", "n2"]],
      },
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 15: Invalid - Flow diagram with invalid node type
  printResult(
    "Test 15: Flow diagram with invalid node type",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: [0, 1, 2],
      choices: ["A", "B", "C"],
      slots: ["First", "Second", "Third"],
      flowConfig: {
        nodes: [
          { id: "n1", label: "Step 1", type: "invalid" }, // Invalid type!
          { id: "n2", label: "Step 2", type: "process" },
        ],
        edges: [["n1", "n2"]],
      },
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 16: Invalid - Flow diagram with empty nodes
  printResult(
    "Test 16: Flow diagram with empty nodes array",
    validateLessonStructure({
      title: "Test",
      content: "Test content",
      info: "Test info",
      question: "Test question?",
      answer: [0, 1, 2],
      choices: ["A", "B", "C"],
      slots: ["First", "Second", "Third"],
      flowConfig: {
        nodes: [], // Empty!
        edges: [],
      },
      questionType: QuestionType.FlowDiagram,
    })
  );

  // Test 17: Validate multiple lessons including flow diagram
  console.log("\n" + "=".repeat(60));
  printResult(
    "Test 17: Validate multiple lessons (including flow diagram)",
    validateLessonsStructure([
      {
        title: "Lesson 1",
        content: "Content 1",
        info: "Info 1",
        question: "Question 1?",
        answer: true,
        questionType: QuestionType.TrueFalse,
      },
      {
        title: "Lesson 2",
        content: "Content 2",
        info: "Info 2",
        question: "Question 2?",
        answer: 5, // Out of range!
        choices: ["A", "B", "C"],
        questionType: QuestionType.MultipleChoice,
      },
      {
        title: "Lesson 3 - Flow",
        content: "Content 3",
        info: "Info 3",
        question: "Order these steps",
        answer: [0, 1, 2],
        choices: ["Step A", "Step B", "Step C"],
        slots: ["First", "Second", "Third"],
        flowConfig: {
          nodes: [
            { id: "a", label: "Step A", type: "start" },
            { id: "b", label: "Step B", type: "process" },
            { id: "c", label: "Step C", type: "output" },
          ],
          edges: [["a", "b"], ["b", "c"]],
        },
        questionType: QuestionType.FlowDiagram,
      },
    ])
  );

  console.log("\n" + "=".repeat(60));
  console.log("🎉 All tests completed!\n");
}

runTests();
