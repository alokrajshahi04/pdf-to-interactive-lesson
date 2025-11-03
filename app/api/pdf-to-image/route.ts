import { NextRequest, NextResponse } from "next/server";
import { getPdfImage } from "../../../lib/utils/pdf-to-image";
import { compressImage } from "../../../lib/utils/compress-image";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a PDF file with the 'file' field." },
        { status: 400 }
      );
    }

    // Validate it's a PDF
    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Get first page as image
    const imageBuffer = await getPdfImage(arrayBuffer);

    if (!imageBuffer) {
      return NextResponse.json(
        { error: "Failed to convert PDF to image" },
        { status: 500 }
      );
    }

    // Optional: compress the image if requested
    const compress = formData.get("compress") === "true";
    const quality = parseInt(formData.get("quality") as string) || 80;
    const format = (formData.get("format") as "png" | "jpeg" | "webp") || "png";

    let finalBuffer = imageBuffer;
    if (compress) {
      finalBuffer = await compressImage(imageBuffer, { quality, format });
    }

    // Determine content type
    const contentType =
      format === "jpeg"
        ? "image/jpeg"
        : format === "webp"
        ? "image/webp"
        : "image/png";

    // Return the image
    return new NextResponse(Buffer.from(finalBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="page-1.${
          format || "png"
        }"`,
        "Content-Length": finalBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
