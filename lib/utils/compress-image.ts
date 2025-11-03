import sharp from "sharp";

export interface CompressionOptions {
  quality?: number; // 1-100, default 80
  format?: "png" | "jpeg" | "webp"; // default: original format
  resize?: {
    width?: number;
    height?: number;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  };
}

/**
 * Compress an image buffer using Sharp
 */
export async function compressImage(
  imageBuffer: Buffer,
  options: CompressionOptions = {}
): Promise<Buffer> {
  const { quality = 80, format, resize } = options;

  let pipeline = sharp(imageBuffer);

  // Apply resize if specified
  if (resize) {
    pipeline = pipeline.resize({
      width: resize.width,
      height: resize.height,
      fit: resize.fit || "inside",
    });
  }

  // Apply format and quality settings
  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality });
  } else if (format === "png") {
    pipeline = pipeline.png({
      quality,
      compressionLevel: 9,
      palette: true, // Use palette-based compression if possible
    });
  }

  return pipeline.toBuffer();
}

/**
 * Get image metadata without fully decoding
 */
export async function getImageInfo(imageBuffer: Buffer) {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: imageBuffer.length,
  };
}
