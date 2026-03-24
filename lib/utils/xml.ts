import { XMLParser } from "fast-xml-parser";
import { QuestionType } from "../types";

/**
 * Extract XML from text that might contain other content
 */
export function extractXml(text: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>.*</${tagName}>`, "s");
  const match = text.match(regex);
  return match ? match[0] : text;
}

/**
 * Create an XML parser configured for course/lesson structures
 */
export function createXMLParser(arrayTags: string[]) {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (tagName) => {
      return arrayTags.includes(tagName);
    },
  });
}

/**
 * Extract JSON from text that might contain other content
 */
export function extractJson(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

/**
 * Flatten XML-parsed choices/slots and convert answer types.
 * Handles quirks where the LLM generates <choice> directly vs nested <choices><choice>.
 */
export function postProcessLesson(lesson: any): any {
  const processed: any = { ...lesson };

  // Flatten choices.choice[] to choices[]
  if (lesson.choices?.choice) {
    processed.choices = lesson.choices.choice;
  } else if (lesson.choice) {
    processed.choices = lesson.choice;
    delete processed.choice;
  }

  // Flatten slots.slot[] to slots[]
  if (lesson.slots?.slot) {
    processed.slots = lesson.slots.slot;
  } else if (lesson.slot) {
    processed.slots = lesson.slot;
    delete processed.slot;
  }

  // Strip answer hints like "(CORRECT)" from choices
  if (Array.isArray(processed.choices)) {
    processed.choices = processed.choices.map((c: any) =>
      typeof c === "string" ? c.replace(/\s*\((?:CORRECT|correct|Correct)\)\s*/g, "").trim() : c
    );
  }

  // Convert answer based on questionType
  if (lesson.questionType === QuestionType.MultipleChoice) {
    processed.answer = parseInt(lesson.answer, 10);
  } else if (lesson.questionType === QuestionType.TrueFalse) {
    processed.answer = lesson.answer === "true" || lesson.answer === true;
  } else if (
    lesson.questionType === QuestionType.DragDrop ||
    lesson.questionType === QuestionType.FlowDiagram
  ) {
    if (typeof lesson.answer === "string") {
      processed.answer = lesson.answer.split(",").map((val: string) => parseInt(val.trim(), 10));
    } else if (Array.isArray(lesson.answer)) {
      processed.answer = lesson.answer.map((val: any) => parseInt(val, 10));
    }
  }

  return processed;
}
