import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

class SimpleCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function testPdf() {
  const pdfPath = "data/1706.03762v7.pdf";
  const buffer = fs.readFileSync(pdfPath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );

  const loadingTask = getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;

  console.log(`PDF has ${pdfDocument.numPages} pages`);

  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  console.log(`Viewport: ${viewport.width} x ${viewport.height}`);

  const canvasFactory = new SimpleCanvasFactory();
  const canvasAndContext = canvasFactory.create(
    viewport.width,
    viewport.height
  );

  console.log(
    `Canvas: ${canvasAndContext.canvas.width} x ${canvasAndContext.canvas.height}`
  );

  // Try rendering with minimal context
  try {
    const renderTask = page.render({
      canvasContext: canvasAndContext.context,
      viewport: viewport,
    });

    await renderTask.promise;
    console.log("✅ Render completed");

    const outputBuffer = canvasAndContext.canvas.toBuffer("image/png");
    fs.writeFileSync("output/simple-test.png", outputBuffer);
    console.log(`✅ Saved: ${outputBuffer.length} bytes`);

    // Try to detect if canvas has any non-white pixels
    const imageData = canvasAndContext.context.getImageData(
      0,
      0,
      Math.min(100, viewport.width),
      Math.min(100, viewport.height)
    );
    let hasColor = false;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      if (!(r === 255 && g === 255 && b === 255) || a !== 255) {
        hasColor = true;
        console.log(
          `Found non-white pixel at index ${i / 4}: rgba(${r},${g},${b},${a})`
        );
        break;
      }
    }

    if (!hasColor) {
      console.log("⚠️  Canvas appears to be completely white!");
    } else {
      console.log("✅ Canvas has content!");
    }
  } catch (error) {
    console.error("❌ Render failed:", error);
  }
}

testPdf();
