import { NextRequest } from "next/server";
import { generateCourseFromPdf } from "../../../lib/generate-course-from-pdf";
import {
  checkRateLimit,
  incrementRateLimit,
  getClientIdentifier,
} from "@/lib/utils/rate-limiter";

// Force Node.js runtime (not Edge) for native modules like sharp
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Increase timeout to 5 minutes (300 seconds) - max for Vercel Pro plan
export const maxDuration = 300;

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

  const clientId = getClientIdentifier(request);

  // Start processing in the background
  (async () => {
    try {
      // Get API key from headers (optional - user can provide their own for unlimited)
      const apiKey = request.headers.get("X-Together-API-Key");
      
      // Check rate limit (bypassed if user has API key)
      const rateLimitCheck = await checkRateLimit(clientId, !!apiKey);
      
      if (!rateLimitCheck.allowed && !apiKey) {
        sendError(
          "You've used your free course. Please add your Together AI API key to generate unlimited courses."
        );
        return;
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const url = formData.get("url") as string | null;

      // Generate course with progress updates
      const result = await generateCourseFromPdf({
        file: file || undefined,
        url: url || undefined,
        apiKey: apiKey || "",
        onProgress: sendProgress,
      });

      // Increment rate limit only if user didn't provide their own API key
      let coursesCreated = rateLimitCheck.coursesCreated;
      if (!apiKey) {
        coursesCreated = await incrementRateLimit(clientId);
      }

      // Send final result with course count info
      sendComplete({
        ...result,
        coursesCreated,
      });
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
