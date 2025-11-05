import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import "pdfjs-dist/build/pdf.worker.mjs";

/**
 * Helper to build a canvas with context for rendering
 */
function buildCanvasWithContext(w: number, h: number) {
  const canvas = createCanvas(w, h);
  return {
    canvas,
    context: canvas.getContext("2d"),
  };
}

/**
 * Adapter for node-canvas to work with pdfjs rendering requirements
 */
class NodeCanvasFactory {
  private skipImages: boolean;

  constructor(skipImages: boolean = false) {
    this.skipImages = skipImages;
  }

  create(w: number, h: number) {
    // If skipImages is true and dimensions suggest this might be an inline image,
    // return a minimal canvas to avoid processing overhead
    if (this.skipImages && (w < 100 || h < 100)) {
      // Create a minimal 1x1 canvas for small images
      const { canvas, context } = buildCanvasWithContext(1, 1);
      return { canvas, context };
    }
    
    const { canvas, context } = buildCanvasWithContext(w, h);
    return { canvas, context };
  }

  reset(canvasAndContext: any, w: number, h: number) {
    if (!canvasAndContext?.canvas) return;
    canvasAndContext.canvas.width = w;
    canvasAndContext.canvas.height = h;
  }

  destroy(canvasAndContext: any) {
    if (!canvasAndContext?.canvas) return;
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

/**
 * Convert PDF data into a PNG image of the first page
 * Note: This function attempts to render with images. May fail on PDFs with inline images.
 * Use getAllPdfImages() for OCR purposes which skips image rendering.
 */
export async function getPdfImage(data: ArrayBuffer): Promise<Buffer | null> {
  const baseDir = process.cwd();
  const pdfjsModulePath = path.join(baseDir, "node_modules", "pdfjs-dist");

  try {
    const doc = await getDocument({
      data,
      cMapUrl: path.join(pdfjsModulePath, "cmaps", path.sep),
      standardFontDataUrl: path.join(
        pdfjsModulePath,
        "standard_fonts",
        path.sep
      ),
      cMapPacked: true,
      isEvalSupported: false,
    }).promise;

    const canvasFactory = new NodeCanvasFactory();
    const page = await doc.getPage(1);
    const view = page.getViewport({ scale: 4.0 });
    const rendered = canvasFactory.create(view.width, view.height);

    await page.render({
      canvasContext: rendered.context,
      viewport: view,
      canvasFactory: canvasFactory,
    } as any).promise;

    return (rendered.canvas as Canvas).toBuffer("image/png");
  } catch (err) {
    console.error("PDF rendering failed:", err);
    if (err instanceof Error && err.message.includes("createCanvas")) {
      console.error(
        "Canvas factory error: This PDF may contain inline images that cannot be rendered.",
        "Consider using a simpler PDF for preview purposes."
      );
    }
    return null;
  }
}

/**
 * Convert all pages of a PDF into PNG images
 * Note: This function skips image rendering to avoid canvas factory conflicts
 * and only renders text content for OCR purposes.
 */
export async function getAllPdfImages(
  data: ArrayBuffer
): Promise<Buffer[] | null> {
  const baseDir = process.cwd();
  const pdfjsModulePath = path.join(baseDir, "node_modules", "pdfjs-dist");

  try {
    const doc = await getDocument({
      data,
      cMapUrl: path.join(pdfjsModulePath, "cmaps", path.sep),
      standardFontDataUrl: path.join(
        pdfjsModulePath,
        "standard_fonts",
        path.sep
      ),
      cMapPacked: true,
      isEvalSupported: false,
    }).promise;

    // Use skipImages flag to minimize image processing overhead
    const canvasFactory = new NodeCanvasFactory(true);
    const pageCount = doc.numPages;
    const images: Buffer[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const view = page.getViewport({ scale: 4.0 });
        const rendered = canvasFactory.create(view.width, view.height);

        // Render with options optimized for text extraction
        await page.render({
          canvasContext: rendered.context,
          viewport: view,
          canvasFactory: canvasFactory,
          renderInteractiveForms: false,
          annotationMode: 0, // Disable annotations
        } as any).promise;

        images.push((rendered.canvas as Canvas).toBuffer("image/png"));
      } catch (pageErr) {
        console.error(`Failed to render page ${pageNum}:`, pageErr);
        // Continue processing other pages even if one fails
      }
    }

    if (images.length === 0) {
      throw new Error("Failed to render any pages from PDF");
    }

    return images;
  } catch (err) {
    console.error("PDF rendering failed:", err);
    if (err instanceof Error && err.message.includes("createCanvas")) {
      console.error(
        "Canvas factory error detected. This may be due to inline images in the PDF."
      );
    }
    return null;
  }
}
