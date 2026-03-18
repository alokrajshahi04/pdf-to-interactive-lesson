import { NextRequest, NextResponse } from "next/server";
import * as mupdf from "mupdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a PDF file with the 'file' field." },
        { status: 400 },
      );
    }

    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = mupdf.Document.openDocument(buffer, "application/pdf");

    if (doc.countPages() === 0) {
      return NextResponse.json({ error: "PDF has no pages" }, { status: 400 });
    }

    // Render first page as PNG at 2x scale (144 DPI)
    const page = doc.loadPage(0);
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
    const pngBuffer = Buffer.from(pixmap.asPNG());

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="page-1.png"',
        "Content-Length": pngBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
