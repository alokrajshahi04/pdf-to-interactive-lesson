import {
  QuestionType,
  type Lesson,
  type ShortAnswerLesson,
  type TrueFalseLesson,
  type MultipleChoiceLesson,
  type DragDropLesson,
  type FlowDiagramLesson,
} from "./types";

export interface ValidationError {
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface StructureValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates the structure and schema of a lesson (deterministic, fast)
 * Does NOT validate content accuracy - use validateLesson() for that
 */
export function validateLessonStructure(
  lesson: any
): StructureValidationResult {
  const errors: ValidationError[] = [];

  // Validate common fields
  errors.push(...validateCommonFields(lesson));

  // Validate question type specific fields
  if (lesson.questionType === QuestionType.MultipleChoice) {
    errors.push(...validateMultipleChoice(lesson));
  } else if (lesson.questionType === QuestionType.TrueFalse) {
    errors.push(...validateTrueFalse(lesson));
  } else if (lesson.questionType === QuestionType.ShortAnswer) {
    errors.push(...validateShortAnswer(lesson));
  } else if (lesson.questionType === QuestionType.DragDrop) {
    errors.push(...validateDragDrop(lesson));
  } else if (lesson.questionType === QuestionType.FlowDiagram) {
    errors.push(...validateFlowDiagram(lesson));
  } else {
    errors.push({
      field: "questionType",
      severity: "error",
      message: `Invalid questionType: "${
        lesson.questionType
      }". Must be one of: ${Object.values(QuestionType).join(", ")}`,
    });
  }

  return {
    isValid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}

/**
 * Validates fields common to all lesson types
 */
function validateCommonFields(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!lesson.title || typeof lesson.title !== "string") {
    errors.push({
      field: "title",
      severity: "error",
      message: "Title is required and must be a string",
    });
  }

  if (!lesson.content || typeof lesson.content !== "string") {
    errors.push({
      field: "content",
      severity: "error",
      message: "Content is required and must be a string",
    });
  }

  if (!lesson.info || typeof lesson.info !== "string") {
    errors.push({
      field: "info",
      severity: "error",
      message: "Info is required and must be a string",
    });
  }

  if (!lesson.question || typeof lesson.question !== "string") {
    errors.push({
      field: "question",
      severity: "error",
      message: "Question is required and must be a string",
    });
  }

  if (!lesson.questionType) {
    errors.push({
      field: "questionType",
      severity: "error",
      message: "QuestionType is required",
    });
  }

  if (lesson.answer === undefined || lesson.answer === null) {
    errors.push({
      field: "answer",
      severity: "error",
      message: "Answer is required",
    });
  }

  return errors;
}

/**
 * Validates multiple choice specific fields
 */
function validateMultipleChoice(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have choices array
  if (!Array.isArray(lesson.choices)) {
    errors.push({
      field: "choices",
      severity: "error",
      message: "Multiple choice questions must have a choices array",
    });
    return errors; // Can't validate further without choices array
  }

  // Choices must have at least 2 options
  if (lesson.choices.length < 2) {
    errors.push({
      field: "choices",
      severity: "error",
      message: `Multiple choice must have at least 2 choices (found ${lesson.choices.length})`,
    });
  }

  // Choices should have 2-6 options (warning for unusual counts)
  if (lesson.choices.length > 6) {
    errors.push({
      field: "choices",
      severity: "warning",
      message: `Multiple choice has ${lesson.choices.length} choices (typically 2-6)`,
    });
  }

  // All choices must be strings or numbers
  lesson.choices.forEach((choice: any, index: number) => {
    if (typeof choice !== "string" && typeof choice !== "number") {
      errors.push({
        field: `choices[${index}]`,
        severity: "error",
        message: `Choice at index ${index} must be a string or number, got ${typeof choice}: ${JSON.stringify(
          choice
        )}`,
      });
    } else if (typeof choice === "string" && choice.trim().length === 0) {
      errors.push({
        field: `choices[${index}]`,
        severity: "error",
        message: `Choice at index ${index} cannot be empty`,
      });
    }
  });

  // Choices must be unique
  const uniqueChoices = new Set(lesson.choices);
  if (uniqueChoices.size !== lesson.choices.length) {
    errors.push({
      field: "choices",
      severity: "error",
      message: "All choices must be unique (found duplicates)",
    });
  }

  // Answer must be a number
  if (typeof lesson.answer !== "number") {
    errors.push({
      field: "answer",
      severity: "error",
      message: `Answer must be a number (choice index), got ${typeof lesson.answer}: ${JSON.stringify(
        lesson.answer
      )}`,
    });
  } else {
    // Answer must be valid index
    if (!Number.isInteger(lesson.answer)) {
      errors.push({
        field: "answer",
        severity: "error",
        message: `Answer must be an integer, got ${lesson.answer}`,
      });
    } else if (lesson.answer < 0 || lesson.answer >= lesson.choices.length) {
      errors.push({
        field: "answer",
        severity: "error",
        message: `Answer index ${lesson.answer} is out of range (must be 0-${
          lesson.choices.length - 1
        })`,
      });
    }
  }

  return errors;
}

/**
 * Validates true/false specific fields
 */
function validateTrueFalse(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Answer must be boolean
  if (typeof lesson.answer !== "boolean") {
    errors.push({
      field: "answer",
      severity: "error",
      message: `True/false answer must be a boolean, got ${typeof lesson.answer}: ${JSON.stringify(
        lesson.answer
      )}`,
    });
  }

  // Should not have choices
  if (lesson.choices !== undefined) {
    errors.push({
      field: "choices",
      severity: "warning",
      message: "True/false questions should not have choices array",
    });
  }

  return errors;
}

/**
 * Validates short answer specific fields
 */
function validateShortAnswer(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Answer must be string
  if (typeof lesson.answer !== "string") {
    errors.push({
      field: "answer",
      severity: "error",
      message: `Short answer must be a string, got ${typeof lesson.answer}: ${JSON.stringify(
        lesson.answer
      )}`,
    });
  } else if (lesson.answer.trim().length === 0) {
    errors.push({
      field: "answer",
      severity: "error",
      message: "Short answer cannot be empty",
    });
  }

  // Should not have choices
  if (lesson.choices !== undefined) {
    errors.push({
      field: "choices",
      severity: "warning",
      message: "Short answer questions should not have choices array",
    });
  }

  return errors;
}

/**
 * Validates drag-drop specific fields
 */
function validateDragDrop(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have choices array
  if (!Array.isArray(lesson.choices)) {
    errors.push({
      field: "choices",
      severity: "error",
      message: "Drag-drop questions must have a choices array",
    });
  } else {
    // Must have exactly 3 choices
    if (lesson.choices.length !== 3) {
      errors.push({
        field: "choices",
        severity: "error",
        message: `Drag-drop must have exactly 3 choices (found ${lesson.choices.length})`,
      });
    }

    // All choices must be strings
    lesson.choices.forEach((choice: any, index: number) => {
      if (typeof choice !== "string") {
        errors.push({
          field: `choices[${index}]`,
          severity: "error",
          message: `Choice at index ${index} must be a string, got ${typeof choice}: ${JSON.stringify(
            choice
          )}`,
        });
      } else if (choice.trim().length === 0) {
        errors.push({
          field: `choices[${index}]`,
          severity: "error",
          message: `Choice at index ${index} cannot be empty`,
        });
      }
    });

    // Choices must be unique
    const uniqueChoices = new Set(lesson.choices);
    if (uniqueChoices.size !== lesson.choices.length) {
      errors.push({
        field: "choices",
        severity: "error",
        message: "All choices must be unique (found duplicates)",
      });
    }
  }

  // Must have slots array
  if (!Array.isArray(lesson.slots)) {
    errors.push({
      field: "slots",
      severity: "error",
      message: "Drag-drop questions must have a slots array",
    });
  } else {
    // Must have exactly 3 slots
    if (lesson.slots.length !== 3) {
      errors.push({
        field: "slots",
        severity: "error",
        message: `Drag-drop must have exactly 3 slots (found ${lesson.slots.length})`,
      });
    }

    // All slots must be strings
    lesson.slots.forEach((slot: any, index: number) => {
      if (typeof slot !== "string") {
        errors.push({
          field: `slots[${index}]`,
          severity: "error",
          message: `Slot at index ${index} must be a string, got ${typeof slot}: ${JSON.stringify(
            slot
          )}`,
        });
      } else if (slot.trim().length === 0) {
        errors.push({
          field: `slots[${index}]`,
          severity: "error",
          message: `Slot at index ${index} cannot be empty`,
        });
      }
    });
  }

  // Answer must be an array
  if (!Array.isArray(lesson.answer)) {
    errors.push({
      field: "answer",
      severity: "error",
      message: `Drag-drop answer must be an array, got ${typeof lesson.answer}: ${JSON.stringify(
        lesson.answer
      )}`,
    });
  } else {
    // Must have exactly 3 elements
    if (lesson.answer.length !== 3) {
      errors.push({
        field: "answer",
        severity: "error",
        message: `Drag-drop answer must have exactly 3 elements (found ${lesson.answer.length})`,
      });
    }

    // All answer elements must be numbers (choice indices)
    lesson.answer.forEach((choiceIndex: any, slotIndex: number) => {
      if (typeof choiceIndex !== "number") {
        errors.push({
          field: `answer[${slotIndex}]`,
          severity: "error",
          message: `Answer at slot index ${slotIndex} must be a number (choice index), got ${typeof choiceIndex}: ${JSON.stringify(
            choiceIndex
          )}`,
        });
      } else if (!Number.isInteger(choiceIndex)) {
        errors.push({
          field: `answer[${slotIndex}]`,
          severity: "error",
          message: `Answer at slot index ${slotIndex} must be an integer, got ${choiceIndex}`,
        });
      } else if (lesson.choices && Array.isArray(lesson.choices)) {
        // Validate choice index is in range
        if (choiceIndex < 0 || choiceIndex >= lesson.choices.length) {
          errors.push({
            field: `answer[${slotIndex}]`,
            severity: "error",
            message: `Answer at slot index ${slotIndex} references invalid choice index ${choiceIndex} (must be 0-${
              lesson.choices.length - 1
            })`,
          });
        }
      }
    });

    // Validate all choice indices are used exactly once
    if (lesson.choices && Array.isArray(lesson.choices) && lesson.answer.length === 3) {
      const usedChoices = new Set(lesson.answer);
      if (usedChoices.size !== 3) {
        errors.push({
          field: "answer",
          severity: "error",
          message: "Each choice must be used exactly once (found duplicates or missing choices)",
        });
      }
    }
  }

  return errors;
}

/**
 * Validates flow diagram specific fields
 */
function validateFlowDiagram(lesson: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have flowConfig
  if (!lesson.flowConfig || typeof lesson.flowConfig !== "object") {
    errors.push({
      field: "flowConfig",
      severity: "error",
      message: "Flow diagram questions must have a flowConfig object",
    });
    return errors; // Can't validate further without flowConfig
  }

  // Validate flowConfig.nodes
  if (!Array.isArray(lesson.flowConfig.nodes)) {
    errors.push({
      field: "flowConfig.nodes",
      severity: "error",
      message: "flowConfig must have a nodes array",
    });
  } else {
    if (lesson.flowConfig.nodes.length === 0) {
      errors.push({
        field: "flowConfig.nodes",
        severity: "error",
        message: "flowConfig must have at least one node",
      });
    }

    // Validate each node
    lesson.flowConfig.nodes.forEach((node: any, index: number) => {
      if (!node.id || typeof node.id !== "string") {
        errors.push({
          field: `flowConfig.nodes[${index}].id`,
          severity: "error",
          message: `Node at index ${index} must have an id string`,
        });
      }
      if (!node.label || typeof node.label !== "string") {
        errors.push({
          field: `flowConfig.nodes[${index}].label`,
          severity: "error",
          message: `Node at index ${index} must have a label string`,
        });
      }
      if (!["start", "process", "output"].includes(node.type)) {
        errors.push({
          field: `flowConfig.nodes[${index}].type`,
          severity: "error",
          message: `Node at index ${index} has invalid type "${node.type}" (must be "start", "process", or "output")`,
        });
      }
    });
  }

  // Validate flowConfig.edges
  if (!Array.isArray(lesson.flowConfig.edges)) {
    errors.push({
      field: "flowConfig.edges",
      severity: "error",
      message: "flowConfig must have an edges array",
    });
  } else {
    // Validate each edge
    lesson.flowConfig.edges.forEach((edge: any, index: number) => {
      if (!Array.isArray(edge) || edge.length !== 2) {
        errors.push({
          field: `flowConfig.edges[${index}]`,
          severity: "error",
          message: `Edge at index ${index} must be an array of [source, target]`,
        });
      } else {
        const [source, target] = edge;
        if (typeof source !== "string" || typeof target !== "string") {
          errors.push({
            field: `flowConfig.edges[${index}]`,
            severity: "error",
            message: `Edge at index ${index} must have string source and target`,
          });
        }
      }
    });
  }

  // Must have choices array
  if (!Array.isArray(lesson.choices)) {
    errors.push({
      field: "choices",
      severity: "error",
      message: "Flow diagram questions must have a choices array",
    });
  } else {
    // Must have exactly 3 choices
    if (lesson.choices.length !== 3) {
      errors.push({
        field: "choices",
        severity: "error",
        message: `Flow diagram must have exactly 3 choices (found ${lesson.choices.length})`,
      });
    }

    // All choices must be strings
    lesson.choices.forEach((choice: any, index: number) => {
      if (typeof choice !== "string") {
        errors.push({
          field: `choices[${index}]`,
          severity: "error",
          message: `Choice at index ${index} must be a string, got ${typeof choice}`,
        });
      } else if (choice.trim().length === 0) {
        errors.push({
          field: `choices[${index}]`,
          severity: "error",
          message: `Choice at index ${index} cannot be empty`,
        });
      }
    });
  }

  // Must have slots array
  if (!Array.isArray(lesson.slots)) {
    errors.push({
      field: "slots",
      severity: "error",
      message: "Flow diagram questions must have a slots array",
    });
  } else {
    // Must have exactly 3 slots
    if (lesson.slots.length !== 3) {
      errors.push({
        field: "slots",
        severity: "error",
        message: `Flow diagram must have exactly 3 slots (found ${lesson.slots.length})`,
      });
    }

    // All slots must be strings
    lesson.slots.forEach((slot: any, index: number) => {
      if (typeof slot !== "string") {
        errors.push({
          field: `slots[${index}]`,
          severity: "error",
          message: `Slot at index ${index} must be a string, got ${typeof slot}`,
        });
      } else if (slot.trim().length === 0) {
        errors.push({
          field: `slots[${index}]`,
          severity: "error",
          message: `Slot at index ${index} cannot be empty`,
        });
      }
    });
  }

  // Answer must be an array
  if (!Array.isArray(lesson.answer)) {
    errors.push({
      field: "answer",
      severity: "error",
      message: `Flow diagram answer must be an array, got ${typeof lesson.answer}`,
    });
  } else {
    // Must have exactly 3 elements
    if (lesson.answer.length !== 3) {
      errors.push({
        field: "answer",
        severity: "error",
        message: `Flow diagram answer must have exactly 3 elements (found ${lesson.answer.length})`,
      });
    }

    // All answer elements must be valid choice indices
    lesson.answer.forEach((choiceIndex: any, slotIndex: number) => {
      if (typeof choiceIndex !== "number") {
        errors.push({
          field: `answer[${slotIndex}]`,
          severity: "error",
          message: `Answer at slot index ${slotIndex} must be a number (choice index), got ${typeof choiceIndex}`,
        });
      } else if (!Number.isInteger(choiceIndex)) {
        errors.push({
          field: `answer[${slotIndex}]`,
          severity: "error",
          message: `Answer at slot index ${slotIndex} must be an integer, got ${choiceIndex}`,
        });
      } else if (lesson.choices && Array.isArray(lesson.choices)) {
        if (choiceIndex < 0 || choiceIndex >= lesson.choices.length) {
          errors.push({
            field: `answer[${slotIndex}]`,
            severity: "error",
            message: `Answer at slot index ${slotIndex} references invalid choice index ${choiceIndex} (must be 0-${
              lesson.choices.length - 1
            })`,
          });
        }
      }
    });

    // Validate all choice indices are used exactly once
    if (lesson.choices && Array.isArray(lesson.choices) && lesson.answer.length === 3) {
      const usedChoices = new Set(lesson.answer);
      if (usedChoices.size !== 3) {
        errors.push({
          field: "answer",
          severity: "error",
          message: "Each choice must be used exactly once (found duplicates or missing choices)",
        });
      }
    }
  }

  return errors;
}

/**
 * Validates multiple lessons and returns aggregated results
 */
export function validateLessonsStructure(
  lessons: any[]
): StructureValidationResult {
  const allErrors: ValidationError[] = [];

  lessons.forEach((lesson, index) => {
    const result = validateLessonStructure(lesson);
    result.errors.forEach((error) => {
      allErrors.push({
        ...error,
        field: `lesson[${index}].${error.field}`,
      });
    });
  });

  return {
    isValid: allErrors.filter((e) => e.severity === "error").length === 0,
    errors: allErrors,
  };
}
