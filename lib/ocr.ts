import axios from "axios";
import { readFileSync } from "fs";
import { getAllPdfImages } from "./utils/pdf-to-image";
import { convertPdfToImages } from "./utils/railway-pdf-service";

const TOGETHER_VISION_MODEL = "meta-llama/Llama-4-Scout-17B-16E-Instruct";

interface OcrOptions {
  maintainFormat?: boolean;
  concurrency?: number;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

interface OcrResult {
  pages: Array<{
    page: number;
    content: string;
    contentLength: number;
  }>;
  inputTokens: number;
  outputTokens: number;
  completionTime: number;
}

/**
 * Convert a single image to markdown using Together AI's vision model
 */
async function imageToMarkdown(
  imageBuffer: Buffer,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    priorPage?: string;
    maintainFormat?: boolean;
  } = {}
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const {
    model = TOGETHER_VISION_MODEL,
    maxTokens = 4000,
    systemPrompt,
    priorPage,
    maintainFormat = false,
  } = options;

  const messages: any[] = [
    {
      role: "system",
      content:
        systemPrompt ||
        `Convert the following document page to markdown.
Return only the markdown with no explanation text. Do not include delimiters like \`\`\`markdown or \`\`\`html.

RULES:
  - Include all information on the page. Do not exclude headers, footers, or subtext.
  - Return tables in HTML format for better structure.
  - Charts & infographics must be interpreted to markdown. Prefer table format when applicable.
  - Wrap logos in tags. Ex: <logo>Coca-Cola</logo>
  - Wrap watermarks in tags. Ex: <watermark>OFFICIAL COPY</watermark>
  - Wrap page numbers in tags. Ex: <page_number>14</page_number>
  - Use ☐ and ☑ for check boxes.
  - Preserve document structure and hierarchy with proper heading levels.`,
    },
  ];

  // Add prior page context if maintaining format
  if (maintainFormat && priorPage) {
    messages.push({
      role: "system",
      content: `Maintain consistent formatting with previous page:\n\n"""${priorPage}"""`,
    });
  }

  // Add the image
  messages.push({
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        },
      },
    ],
  });

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      content: response.data.choices[0].message.content,
      inputTokens: response.data.usage?.prompt_tokens || 0,
      outputTokens: response.data.usage?.completion_tokens || 0,
    };
  } catch (error: any) {
    throw new Error(
      `OCR failed: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

/**
 * Process images with concurrency control
 */
async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = processor(items[i], i).then((result) => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Extract text from PDF using vision model OCR
 *
 * @param filePath - Path to PDF file
 * @param options - OCR configuration options
 * @returns OCR result with pages and token usage
 */
export async function ocr(
  filePath: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const {
    maintainFormat = false,
    concurrency = 5,
    model,
    maxTokens,
    systemPrompt,
  } = options;

  const startTime = Date.now();

  // Read PDF and convert to images
  const fileBuffer = readFileSync(filePath);
  
  let imageBuffers: Buffer[];
  
  // Use Railway API if available, otherwise fall back to local pdfjs
  if (process.env.RAILWAY_API_URL) {
    console.log("   Using Railway API for PDF conversion...");
    imageBuffers = await convertPdfToImages(fileBuffer);
  } else {
    console.log("   Using local PDF.js for PDF conversion...");
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const result = await getAllPdfImages(arrayBuffer);
    
    if (!result || result.length === 0) {
      throw new Error("Failed to convert PDF to images");
    }
    
    imageBuffers = result;
  }

  if (!imageBuffers || imageBuffers.length === 0) {
    throw new Error("Failed to convert PDF to images");
  }

  console.log(`   Converting ${imageBuffers.length} pages to markdown...`);

  // Process images with concurrency control
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let priorPageContent: string | undefined;

  const pageResults = await processConcurrent(
    imageBuffers,
    async (imageBuffer, index) => {
      const pageNum = index + 1;
      console.log(`   📄 Processing page ${pageNum}/${imageBuffers.length}...`);

      const result = await imageToMarkdown(imageBuffer, {
        model,
        maxTokens,
        systemPrompt,
        priorPage: maintainFormat ? priorPageContent : undefined,
        maintainFormat,
      });

      // Update for next page if maintaining format
      if (maintainFormat) {
        priorPageContent = result.content;
      }

      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      return {
        page: pageNum,
        content: result.content,
        contentLength: result.content.length,
      };
    },
    concurrency
  );

  const completionTime = Date.now() - startTime;

  return {
    pages: pageResults,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    completionTime,
  };
}
