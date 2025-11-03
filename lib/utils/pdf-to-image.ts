import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, type Canvas } from "canvas";
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
const nodeCanvasAdapter = {
  create: (w: number, h: number) => buildCanvasWithContext(w, h),
  reset: (target: any, w: number, h: number) => {
    if (target?.canvas) {
      target.canvas.width = w;
      target.canvas.height = h;
    }
  },
  destroy: (target: any) => {
    if (target?.canvas) {
      target.canvas.width = 0;
      target.canvas.height = 0;
    }
  },
};

/**
 * Convert PDF data into a PNG image of the first page
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

    const page = await doc.getPage(1);
    const view = page.getViewport({ scale: 4.0 });
    const rendered = nodeCanvasAdapter.create(view.width, view.height);

    await page.render({
      canvasContext: rendered.context,
      viewport: view,
      canvasFactory: nodeCanvasAdapter,
    } as any).promise;

    return (rendered.canvas as Canvas).toBuffer("image/png");
  } catch (err) {
    console.error("PDF rendering failed:", err);
    return null;
  }
}

/**
 * Convert all pages of a PDF into PNG images
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

    const pageCount = doc.numPages;
    const images: Buffer[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const view = page.getViewport({ scale: 4.0 });
      const rendered = nodeCanvasAdapter.create(view.width, view.height);

      await page.render({
        canvasContext: rendered.context,
        viewport: view,
        canvasFactory: nodeCanvasAdapter,
      } as any).promise;

      images.push((rendered.canvas as Canvas).toBuffer("image/png"));
    }

    return images;
  } catch (err) {
    console.error("PDF rendering failed:", err);
    return null;
  }
}
