import { XMLParser } from "fast-xml-parser";

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
