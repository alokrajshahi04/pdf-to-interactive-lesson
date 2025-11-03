# Scripts

This directory contains utility scripts for the PDF-to-Interactive-Lesson project.

## pdf-to-image.ts

Converts the first page of a PDF file to a PNG image.

### Usage

Using Node.js directly:

```bash
node scripts/pdf-to-image.ts <pdf-path> [output-path]
```

Using npm script:

```bash
npm run pdf-to-image -- <pdf-path> [output-path]
```

### Arguments

- `<pdf-path>` (required): Path to the PDF file to convert
- `[output-path]` (optional): Path where the PNG image will be saved. If not provided, defaults to `output/<pdf-name>-page1.png`

### Examples

Convert a PDF with default output path:

```bash
node scripts/pdf-to-image.ts data/1706.03762v7.pdf
# Output: output/1706.03762v7-page1.png
```

Convert a PDF with custom output path:

```bash
node scripts/pdf-to-image.ts data/1706.03762v7.pdf my-image.png
```

Using npm script:

```bash
npm run pdf-to-image -- data/1706.03762v7.pdf output/custom.png
```

### Requirements

- Node.js v23+ (uses experimental type stripping)
- The `canvas` and `pdfjs-dist` packages (already in dependencies)

### Notes

- Only the first page of the PDF is converted
- The output is a PNG image with 2x scale for better quality
- The output directory will be created automatically if it doesn't exist
