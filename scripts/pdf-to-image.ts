#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  convertPdfToImages,
  getImageDimensions,
  type PdfConversionOptions,
} from "../lib/utils/pdf-to-images-batch.ts";

async function processPdfWithLogging(
  pdfPath: string,
  options: PdfConversionOptions
) {
  console.log(`\n📄 Processing: ${path.basename(pdfPath)}`);
  console.log(`   Size: ${(fs.statSync(pdfPath).size / 1024).toFixed(2)} KB`);
  console.log(`   🖼️  Converting pages...`);

  if (options.compress) {
    console.log(`   🗜️  Compressing with quality ${options.quality || 80}...`);
  }

  const result = await convertPdfToImages(pdfPath, options);

  if (!result.success) {
    console.error(`   ❌ ${result.error || "Failed to convert PDF"}`);
    return false;
  }

  console.log(`   ✅ Generated ${result.pagesGenerated} page(s)`);

  // Log each output file with dimensions
  for (let i = 0; i < result.outputFiles.length; i++) {
    const filePath = result.outputFiles[i];
    const buffer = fs.readFileSync(filePath);
    const { width, height } = getImageDimensions(buffer);
    const fileSize = buffer.length;

    if (options.compress) {
      const originalSize = result.totalSize / result.outputFiles.length;
      const sizeStr = `${(originalSize / 1024).toFixed(2)}KB → ${(
        fileSize / 1024
      ).toFixed(2)}KB`;
      console.log(`      Page ${i + 1}: ${width}x${height}px (${sizeStr})`);
    } else {
      console.log(
        `      Page ${i + 1}: ${width}x${height}px (${(fileSize / 1024).toFixed(
          2
        )}KB)`
      );
    }
  }

  // Summary
  if (options.compress) {
    const savings = (
      (1 - result.compressedSize / result.totalSize) *
      100
    ).toFixed(1);
    console.log(
      `   📦 Total: ${(result.totalSize / 1024).toFixed(2)}KB → ${(
        result.compressedSize / 1024
      ).toFixed(2)}KB (${savings}% saved)`
    );
  } else {
    console.log(`   📦 Total size: ${(result.totalSize / 1024).toFixed(2)} KB`);
  }

  return true;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node scripts/pdf-to-image.ts <path> [options]");
    console.error("\nOptions:");
    console.error(
      "  --output <dir>         Output directory (default: output/)"
    );
    console.error("  --compress             Enable compression");
    console.error("  --quality <1-100>      Compression quality (default: 80)");
    console.error("  --format <png|jpeg|webp>  Output format (default: png)");
    console.error("\nExamples:");
    console.error("  node scripts/pdf-to-image.ts data/file.pdf");
    console.error(
      "  node scripts/pdf-to-image.ts data/file.pdf --compress --quality 75"
    );
    console.error(
      "  node scripts/pdf-to-image.ts data/ --compress --format webp"
    );
    console.error(
      "  node scripts/pdf-to-image.ts data/ --output compressed/ --compress"
    );
    process.exit(1);
  }

  const inputPath = args[0];
  let outputDir: string | undefined;
  let compress = false;
  let quality = 80;
  let format: "png" | "jpeg" | "webp" | undefined;

  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--output":
        outputDir = args[++i];
        break;
      case "--compress":
        compress = true;
        break;
      case "--quality":
        quality = parseInt(args[++i], 10);
        if (isNaN(quality) || quality < 1 || quality > 100) {
          console.error("Quality must be between 1 and 100");
          process.exit(1);
        }
        break;
      case "--format":
        const fmt = args[++i];
        if (fmt !== "png" && fmt !== "jpeg" && fmt !== "webp") {
          console.error("Format must be png, jpeg, or webp");
          process.exit(1);
        }
        format = fmt;
        break;
    }
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);
  const options: PdfConversionOptions = {
    outputDir,
    compress,
    quality,
    format,
  };

  if (stats.isDirectory()) {
    // Process all PDFs in directory
    const files = fs
      .readdirSync(inputPath)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => path.join(inputPath, f));

    if (files.length === 0) {
      console.error(`No PDF files found in: ${inputPath}`);
      process.exit(1);
    }

    console.log(`\n🚀 Processing ${files.length} PDF file(s)...`);

    let success = 0;
    let failed = 0;

    for (const pdfPath of files) {
      const result = await processPdfWithLogging(pdfPath, options);
      if (result) success++;
      else failed++;
    }

    console.log(`\n📊 Complete: ${success} succeeded, ${failed} failed`);
  } else {
    // Process single PDF
    const result = await processPdfWithLogging(inputPath, options);
    process.exit(result ? 0 : 1);
  }
}

main();
