import axios from "axios";
import { readFileSync } from "fs";
import { getAllPdfImages } from "./utils/pdf-to-image";
import { convertPdfToImages } from "./utils/railway-pdf-service";

const TOGETHER_VISION_MODEL = "zai-org/GLM-5";
const VISION_MODEL_FALLBACKS = [
  "zai-org/GLM-5",
  "moonshotai/Kimi-K2.5",
  "MiniMaxAI/MiniMax-M2.5",
];

export interface OcrProgressCallback {
  (type: string, message: string, data?: any): void;
}

interface OcrOptions {
  apiKey: string;
  maintainFormat?: boolean;
  concurrency?: number;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  startDelay?: number; // Delay in ms between starting each concurrent request
  onProgress?: OcrProgressCallback;
}

interface OcrResult {
  pages: Array<{
    page: number;
    content: string;
    contentLength: number;
    success: boolean;
    error?: string;
  }>;
  inputTokens: number;
  outputTokens: number;
  completionTime: number;
  failedPages: number;
  successfulPages: number;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a single image to markdown using Together AI's vision model.
 * Tries fallback models if the primary model is unavailable, and retries
 * transient errors with exponential backoff.
 */
async function imageToMarkdown(
  imageBuffer: Buffer,
  options: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    priorPage?: string;
    maintainFormat?: boolean;
    retries?: number;
    pageContext?: string;
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const {
    apiKey,
    model: requestedModel = TOGETHER_VISION_MODEL,
    maxTokens = 4000,
    systemPrompt,
    priorPage,
    maintainFormat = false,
    retries = 5,
    pageContext = "page",
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

  if (maintainFormat && priorPage) {
    messages.push({
      role: "system",
      content: `Maintain consistent formatting with previous page:\n\n"""${priorPage}"""`,
    });
  }

  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: "Convert this document page to markdown.",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        },
      },
    ],
  });

  // Build ordered model list: requested model first, then fallbacks (deduplicated)
  const modelsToTry = [
    requestedModel,
    ...VISION_MODEL_FALLBACKS.filter((m) => m !== requestedModel),
  ];

  let lastError: any;

  for (const currentModel of modelsToTry) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const baseDelay = 1000 * Math.pow(2, attempt - 1);
          const jitter = 0.8 + Math.random() * 0.4;
          const delayMs = Math.min(Math.floor(baseDelay * jitter), 20000);
          console.log(`   ⏳ [${pageContext}] Retry ${attempt}/${retries} after ${delayMs}ms...`);
          await sleep(delayMs);
        }

        const response = await axios.post(
          "https://api.together.xyz/v1/chat/completions",
          {
            model: currentModel,
            messages,
            max_tokens: maxTokens,
            temperature: 0,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );

        if (currentModel !== requestedModel) {
          console.log(`   ✅ [${pageContext}] Succeeded with fallback model ${currentModel}`);
        } else if (attempt > 0) {
          console.log(`   ✅ [${pageContext}] Succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
        }

        return {
          content: response.data.choices[0].message.content,
          inputTokens: response.data.usage?.prompt_tokens || 0,
          outputTokens: response.data.usage?.completion_tokens || 0,
        };
      } catch (error: any) {
        lastError = error;

        // If the model itself is unavailable, skip straight to next fallback
        const errorCode =
          typeof error.response?.data === "string"
            ? undefined
            : error.response?.data?.error?.code;
        if (errorCode === "model_not_available") {
          console.warn(`   ⚠️  [${pageContext}] Model ${currentModel} is unavailable, trying next fallback...`);
          break;
        }

        const status = error.response?.status;
        const shouldRetry =
          status === 503 ||
          status === 429 ||
          status === 500 ||
          !error.response;

        if (!shouldRetry || attempt === retries) {
          break;
        }

        console.warn(`   ⚠️  [${pageContext}] Attempt ${attempt + 1} failed (${status || 'network error'}), retrying...`);
      }
    }
  }

  // All models and retries exhausted
  const error = lastError;
  let errorMsg = "OCR API call failed";

  if (error.response) {
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data = error.response.data;

    errorMsg = `Together AI API error (${status} ${statusText})`;

    if (data?.error?.message) {
      errorMsg += `: ${data.error.message}`;
    } else if (data?.message) {
      errorMsg += `: ${data.message}`;
    } else if (typeof data === "string") {
      errorMsg += `: ${data.substring(0, 200)}`;
    }

    if (status === 401) {
      errorMsg += " - Check TOGETHER_API_KEY in .env.local";
    } else if (status === 429) {
      errorMsg += " - Rate limit exceeded";
    } else if (status === 503) {
      errorMsg += " - Service temporarily unavailable";
    }

    errorMsg += ` (tried ${modelsToTry.length} models, ${retries + 1} attempts each)`;

    console.error("Full API error:", {
      status,
      statusText,
      data: JSON.stringify(data, null, 2),
      url: error.config?.url,
      modelsTried: modelsToTry,
    });
  } else if (error.request) {
    errorMsg = `No response from Together AI API - network error or timeout (tried ${modelsToTry.length} models)`;
    console.error("Network error:", error.message);
  } else {
    errorMsg = `OCR setup error: ${error.message}`;
    console.error("OCR error:", error);
  }

  throw new Error(errorMsg);
}

/**
 * Process images with concurrency control
 */
async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number,
  startDelay: number = 200,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let completed = 0;
  const executing = new Set<Promise<void>>();

  // Start initial batch without delay
  while (index < Math.min(concurrency, items.length)) {
    const currentIndex = index++;
    const promise = processor(items[currentIndex], currentIndex)
      .then((result) => {
        results[currentIndex] = result;
        completed++;
        onProgress?.(completed, items.length);
      })
      .finally(() => {
        executing.delete(promise);
      });
    executing.add(promise);
  }

  // Process remaining items with concurrency control
  while (index < items.length || executing.size > 0) {
    // If we have capacity and more items to process, start a new one
    if (index < items.length && executing.size < concurrency) {
      // Add delay before starting next request (to stagger load)
      if (startDelay > 0) {
        await sleep(startDelay);
      }

      const currentIndex = index++;
      const promise = processor(items[currentIndex], currentIndex)
        .then((result) => {
          results[currentIndex] = result;
          completed++;
          onProgress?.(completed, items.length);
        })
        .finally(() => {
          executing.delete(promise);
        });
      executing.add(promise);
    } else if (executing.size > 0) {
      // Wait for at least one promise to complete
      await Promise.race(executing);
    }
  }

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
  options: OcrOptions
): Promise<OcrResult> {
  const {
    apiKey,
    maintainFormat = false,
    concurrency = 5,
    model,
    maxTokens,
    systemPrompt,
    startDelay = 200,
    onProgress,
  } = options;

  const startTime = Date.now();

  // Check for required API key
  if (!apiKey) {
    throw new Error(
      "Together AI API key is required. Please add your API key in the app settings."
    );
  }

  // Read PDF and convert to images
  const fileBuffer = readFileSync(filePath);
  
  let imageBuffers: Buffer[];
  
  // Use Railway API if available, otherwise fall back to local pdfjs
  if (process.env.RAILWAY_API_URL) {
    try {
      imageBuffers = await convertPdfToImages(fileBuffer);
    } catch (error) {
      console.error("   ❌ Railway API failed:", error);
      throw error;
    }
  } else {
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

  // Enforce page limit
  const MAX_PAGES = 100;
  if (imageBuffers.length > MAX_PAGES) {
    throw new Error(
      `PDF has ${imageBuffers.length} pages, but we currently only support PDFs up to ${MAX_PAGES} pages. Please upload a shorter document.`
    );
  }

  onProgress?.("ocr-start", `Extracting text from ${imageBuffers.length} pages...`, {
    totalPages: imageBuffers.length,
  });

  // Process images with concurrency control
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let priorPageContent: string | undefined;

  const pageResults = await processConcurrent(
    imageBuffers,
    async (imageBuffer, index) => {
      const pageNum = index + 1;
      const pageContext = `page ${pageNum}/${imageBuffers.length}`;

      try {
        const result = await imageToMarkdown(imageBuffer, {
          apiKey,
          model,
          maxTokens,
          systemPrompt,
          priorPage: maintainFormat ? priorPageContent : undefined,
          maintainFormat,
          pageContext,
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
          success: true,
        };
      } catch (error: any) {
        // Log the error but continue with other pages
        console.error(`   ❌ [${pageContext}] Failed: ${error.message}`);
        return {
          page: pageNum,
          content: `[Page ${pageNum} could not be processed due to API errors]`,
          contentLength: 0,
          success: false,
          error: error.message,
        };
      }
    },
    concurrency,
    startDelay,
    (completed, total) => {
      onProgress?.("ocr-progress", `Extracting text from PDF (${completed}/${total} pages)`, {
        completed,
        total,
        currentPage: completed,
      });
    }
  );

  const completionTime = Date.now() - startTime;

  // Check for failed pages
  const failedPages = pageResults.filter((p: any) => !p.success);
  const successfulPages = pageResults.filter((p: any) => p.success);
  
  if (failedPages.length > 0) {
    const failedPageNumbers = failedPages.map((p: any) => p.page).join(", ");
    console.warn(`   ⚠️  ${failedPages.length}/${imageBuffers.length} page(s) failed to process: ${failedPageNumbers}`);
    
    // Send warning progress update
    onProgress?.("ocr-complete", 
      `Extracted text from ${successfulPages.length}/${imageBuffers.length} pages (${failedPages.length} page(s) failed due to API errors)`, 
      {
        totalPages: imageBuffers.length,
        completed: successfulPages.length,
        failed: failedPages.length,
        failedPages: failedPageNumbers,
      }
    );
    
    // Only throw if ALL pages failed (complete failure)
    if (failedPages.length === imageBuffers.length) {
      throw new Error(`Failed to process any pages from PDF. All ${imageBuffers.length} pages failed due to API errors.`);
    }
  } else {
    // All pages successful
    onProgress?.("ocr-complete", `Extracted text from all ${imageBuffers.length} pages`, {
      totalPages: imageBuffers.length,
      completed: imageBuffers.length,
    });
  }

  return {
    pages: pageResults,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    completionTime,
    failedPages: failedPages.length,
    successfulPages: successfulPages.length,
  };
}
