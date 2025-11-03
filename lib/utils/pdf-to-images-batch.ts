import fs from "node:fs";
import path from "node:path";
import { getAllPdfImages } from "./pdf-to-image.ts";
import { compressImage } from "./compress-image.ts";

export interface PdfConversionOptions {
  outputDir?: string;
  compress?: boolean;
  quality?: number;
  format?: "png" | "jpeg" | "webp";
}

export interface ConversionResult {
  success: boolean;
  pagesGenerated: number;
  totalSize: number;
  compressedSize: number;
  outputFiles: string[];
  error?: string;
}

/**
 * Convert a single PDF file to images with optional compression
 */
export async function convertPdfToImages(
  pdfPath: string,
  options: PdfConversionOptions = {}
): Promise<ConversionResult> {
  const {
    outputDir = "output",
    compress = false,
    quality = 80,
    format,
  } = options;

  const baseName = path.basename(pdfPath, ".pdf");
  const outputFiles: string[] = [];
  let totalSize = 0;
  let totalCompressedSize = 0;

  try {
    // Read PDF file
    const buffer = fs.readFileSync(pdfPath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    // Convert to images
    const imageBuffers = await getAllPdfImages(arrayBuffer);

    if (!imageBuffers || imageBuffers.length === 0) {
      return {
        success: false,
        pagesGenerated: 0,
        totalSize: 0,
        compressedSize: 0,
        outputFiles: [],
        error: "Failed to convert PDF to images",
      };
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process each page
    for (let i = 0; i < imageBuffers.length; i++) {
      let imageBuffer = imageBuffers[i];
      const originalSize = imageBuffer.length;
      totalSize += originalSize;

      // Compress if requested
      if (compress) {
        imageBuffer = await compressImage(imageBuffer, { quality, format });
      }
      totalCompressedSize += imageBuffer.length;

      // Determine output path
      const ext = format || "png";
      const outputPath = path.join(
        outputDir,
        `${baseName}-page${i + 1}.${ext}`
      );

      // Write file
      fs.writeFileSync(outputPath, imageBuffer);
      outputFiles.push(outputPath);
    }

    return {
      success: true,
      pagesGenerated: imageBuffers.length,
      totalSize,
      compressedSize: totalCompressedSize,
      outputFiles,
    };
  } catch (error) {
    return {
      success: false,
      pagesGenerated: 0,
      totalSize: 0,
      compressedSize: 0,
      outputFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert multiple PDF files to images
 */
export async function convertMultiplePdfs(
  pdfPaths: string[],
  options: PdfConversionOptions = {}
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];

  for (const pdfPath of pdfPaths) {
    const result = await convertPdfToImages(pdfPath, options);
    results.push(result);
  }

  return results;
}

/**
 * Get image dimensions from buffer
 */
export function getImageDimensions(imageBuffer: Buffer): {
  width: number;
  height: number;
} {
  // Read PNG dimensions from header
  const png = imageBuffer.slice(16, 24);
  const width = png.readUInt32BE(0);
  const height = png.readUInt32BE(4);
  return { width, height };
}

