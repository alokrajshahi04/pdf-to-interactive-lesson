/**
 * Railway PDF Service
 * Converts PDFs to images using PyMuPDF on Railway
 */

export interface PdfInfo {
  success: boolean;
  pageCount: number;
  title?: string;
  author?: string;
  error?: string;
}

export interface PdfPageImage {
  success: boolean;
  page: number;
  data: string; // base64
  width: number;
  height: number;
  error?: string;
}

/**
 * Get PDF info (page count, metadata)
 * @param pdfBuffer - PDF file as Buffer
 * @returns PDF info
 */
export async function getPdfInfo(pdfBuffer: Buffer): Promise<PdfInfo> {
  const railwayUrl = process.env.RAILWAY_API_URL;

  if (!railwayUrl) {
    throw new Error("RAILWAY_API_URL environment variable not set");
  }

  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("file", blob, "document.pdf");

  const response = await fetch(`${railwayUrl}/pdf-info`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
    }));
    throw new Error(`Railway API error: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Convert a single PDF page to image
 * @param pdfBuffer - PDF file as Buffer
 * @param page - Page number (1-indexed)
 * @returns Base64 encoded image
 */
export async function convertPdfPageToImage(
  pdfBuffer: Buffer,
  page: number
): Promise<Buffer> {
  const railwayUrl = process.env.RAILWAY_API_URL;

  if (!railwayUrl) {
    throw new Error("RAILWAY_API_URL environment variable not set");
  }

  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("file", blob, "document.pdf");
  formData.append("page", page.toString());

  const response = await fetch(`${railwayUrl}/pdf-page-to-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
    }));
    throw new Error(
      `Railway API error (page ${page}): ${error.error || response.statusText}`
    );
  }

  const result: PdfPageImage = await response.json();

  if (!result.success || !result.data) {
    throw new Error(
      result.error || `Failed to convert page ${page} to image`
    );
  }

  return Buffer.from(result.data, "base64");
}

/**
 * Convert PDF to images using Railway API (concurrent page processing)
 * @param pdfBuffer - PDF file as Buffer
 * @param concurrency - Max concurrent requests (default: 5)
 * @returns Array of base64 encoded images
 */
export async function convertPdfToImages(
  pdfBuffer: Buffer,
  concurrency: number = 5
): Promise<Buffer[]> {
  // Get page count first
  const info = await getPdfInfo(pdfBuffer);

  if (!info.success) {
    throw new Error(info.error || "Failed to get PDF info");
  }

  const pageCount = info.pageCount;
  const results: Buffer[] = new Array(pageCount);
  const errors: string[] = [];

  // Process pages with concurrency control
  const processBatch = async (pageNumbers: number[]) => {
    await Promise.all(
      pageNumbers.map(async (pageNum) => {
        try {
          const buffer = await convertPdfPageToImage(pdfBuffer, pageNum);
          results[pageNum - 1] = buffer;
        } catch (error) {
          const errMsg = `Page ${pageNum}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errMsg);
          console.error(`Failed to convert page ${pageNum}:`, error);
        }
      })
    );
  };

  // Process in batches
  for (let i = 0; i < pageCount; i += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, pageCount - i) },
      (_, j) => i + j + 1
    );
    await processBatch(batch);
  }

  // Check if we got all pages
  const successCount = results.filter(Boolean).length;
  if (successCount === 0) {
    throw new Error(`Failed to convert any pages. Errors: ${errors.join("; ")}`);
  }

  if (errors.length > 0) {
    console.warn(
      `Converted ${successCount}/${pageCount} pages. ${errors.length} failed: ${errors.join("; ")}`
    );
  }

  return results.filter(Boolean); // Return only successful conversions
}

