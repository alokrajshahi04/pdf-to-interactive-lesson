/**
 * Shared type definitions for course and lesson generation
 */

export interface Module {
  title: string;
}

export enum QuestionType {
  MultipleChoice = "multiple-choice",
  TrueFalse = "true-false",
  ShortAnswer = "short-answer",
}

export interface FixAttempt {
  attempt: number;
  validationType: "structure" | "content";
  reason: string;
  details: string[];
  lesson?: any; // Snapshot of the lesson at this attempt (for debugging)
}

export interface LessonBase {
  title: string;
  content: string;
  info: string;
  question: string;
  questionType: QuestionType;
  fixHistory?: FixAttempt[]; // Present only if lesson was fixed after failing validation
}

export interface ShortAnswerLesson extends LessonBase {
  questionType: QuestionType.ShortAnswer;
  answer: string;
}

export interface TrueFalseLesson extends LessonBase {
  questionType: QuestionType.TrueFalse;
  answer: boolean;
}

export interface MultipleChoiceLesson extends LessonBase {
  questionType: QuestionType.MultipleChoice;
  answer: number; // Index of the correct choice (0-based)
  choices: (string | number)[]; // Choices can be strings or numbers
}

export type Lesson = ShortAnswerLesson | TrueFalseLesson | MultipleChoiceLesson;

export interface LessonError {
  validationType: "structure" | "content";
  reason: string;
  details?: string[];
  attempts?: number; // Number of fix attempts made (if retry was enabled)
  fixHistory?: FixAttempt[]; // History of all fix attempts (if retry was enabled)
}

export interface SuccessfulLesson {
  success: true;
  data: Lesson;
  error?: never; // Explicitly no error for successful lessons
}

export interface FailedLesson {
  success: false;
  data: any; // Partial/invalid lesson data
  error: LessonError;
}

export type LessonResult = SuccessfulLesson | FailedLesson;

export interface ModuleWithLessons {
  title: string;
  lessons: LessonResult[];
}

export interface CourseStructure {
  course: {
    title: string;
    module: Module[];
  };
}
