import { NextRequest } from "next/server";
import { generateCourseFromPdf } from "../../../lib/generate-course-from-pdf";

// Force Node.js runtime (not Edge) for native modules like sharp
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to create a streaming response with progress updates
function createStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  const sendProgress = (type: string, message: string, data?: any) => {
    const progressEvent = {
      type,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };
    controller.enqueue(encoder.encode(JSON.stringify(progressEvent) + "\n"));
  };

  const sendComplete = (data: any) => {
    controller.enqueue(
      encoder.encode(JSON.stringify({ type: "complete", data }) + "\n")
    );
    controller.close();
  };

  const sendError = (error: string) => {
    controller.enqueue(
      encoder.encode(JSON.stringify({ type: "error", error }) + "\n")
    );
    controller.close();
  };

  return { stream, sendProgress, sendComplete, sendError };
}

// POST /api/generate-course
export async function POST(request: NextRequest) {
  const { stream, sendProgress, sendComplete, sendError } =
    createStreamResponse();

  // Start processing in the background
  (async () => {
    try {
      // Get API key from headers
      const apiKey = request.headers.get("X-Together-API-Key");
      if (!apiKey) {
        sendError("Together AI API key is required. Please add it in the app settings.");
        return;
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const url = formData.get("url") as string | null;

      // Generate course with progress updates
      const result = await generateCourseFromPdf({
        file: file || undefined,
        url: url || undefined,
        apiKey,
        onProgress: sendProgress,
      });

      // Send final result
      sendComplete(result);
    } catch (error) {
      console.error("❌ Error generating course:", error);
      sendError(error instanceof Error ? error.message : "Unknown error");
    }
  })();

  // Return the streaming response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
