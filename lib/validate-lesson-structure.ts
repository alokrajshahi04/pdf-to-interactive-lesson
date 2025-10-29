import {
  QuestionType,
  type Lesson,
  type ShortAnswerLesson,
  type TrueFalseLesson,
  type MultipleChoiceLesson,
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
