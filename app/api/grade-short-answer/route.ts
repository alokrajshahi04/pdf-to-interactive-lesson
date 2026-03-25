import { NextRequest } from "next/server";
import { generateText } from "ai";
import { createTogetherClient, DEFAULT_MODEL } from "@/lib/utils/together";
import { extractJson } from "@/lib/utils/xml";
import { debugLog } from "@/lib/utils/debug";
import {
  getClientIdentifier,
  checkGradingLimit,
  incrementGradingLimit,
} from "@/lib/utils/rate-limiter";

// Force Node.js runtime (not Edge) for native modules
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/grade-short-answer
export async function POST(request: NextRequest) {
  try {
    // Get API key from headers, fall back to server key for free users
    const userApiKey = request.headers.get("X-Together-API-Key");
    const apiKey = userApiKey || process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      debugLog.error("[API] No API key available (neither user nor server)");
      return Response.json(
        { error: "No API key available for grading" },
        { status: 500 }
      );
    }

    // Check grading limit (bypass if user has their own API key)
    if (!userApiKey) {
      const clientId = getClientIdentifier(request);
      const gradingCheck = await checkGradingLimit(clientId, false);
      if (!gradingCheck.allowed) {
        return Response.json(
          { error: "You've used all your free grading credits. Please add your Together AI API key for unlimited grading." },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { userAnswer, correctAnswer, content, info, question } = body;

    // Validate required fields
    if (
      typeof userAnswer !== "string" ||
      typeof correctAnswer !== "string" ||
      typeof content !== "string" ||
      typeof info !== "string" ||
      typeof question !== "string"
    ) {
      debugLog.error("[API] Validation failed - missing or invalid fields", {
        userAnswer: typeof userAnswer,
        correctAnswer: typeof correctAnswer,
        content: typeof content,
        info: typeof info,
        question: typeof question,
      });
      return Response.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    const together = createTogetherClient(apiKey);

    // Use LLM to evaluate if the user's answer demonstrates understanding
    const llmStartTime = Date.now();
    const result = await generateText({
      model: together(DEFAULT_MODEL),
      prompt: `You are an educational assessment evaluator. Evaluate whether a student's answer to a short-answer question demonstrates understanding of the material.

Lesson Content:
${content}

Key Information:
${info}

Question:
${question}

Correct Answer:
${correctAnswer}

Student's Answer:
${userAnswer}

Evaluate whether the student's answer demonstrates understanding of the material. The answer does not need to match the correct answer word-for-word, but should demonstrate comprehension of the key concepts.

Respond ONLY with valid JSON in this exact format:
{
  "isCorrect": true or false,
  "explanation": "Brief explanation of why the answer is correct or incorrect"
}`,
    });

    try {
      // Extract JSON from response (in case there's extra text)
      const jsonText = extractJson(result.text);
      const evaluation = JSON.parse(jsonText);

      // Validate the response structure
      if (typeof evaluation.isCorrect !== "boolean") {
        debugLog.error("[API] Invalid response format", evaluation);
        throw new Error("Invalid response format: isCorrect must be boolean");
      }

      // Increment grading counter for free users
      if (!userApiKey) {
        const clientId = getClientIdentifier(request);
        await incrementGradingLimit(clientId);
      }

      return Response.json({
        isCorrect: evaluation.isCorrect,
        explanation: evaluation.explanation || undefined,
      });
    } catch (error) {
      debugLog.error("[API] Failed to parse evaluation response", {
        error: error instanceof Error ? error.message : "Unknown error",
        responseText: result.text.substring(0, 500),
      });
      return Response.json(
        {
          error: "Failed to evaluate answer - invalid response format",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    debugLog.error("[API] Error grading short answer", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Response.json(
      {
        error: "Failed to grade answer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

