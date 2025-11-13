import { NextRequest } from "next/server";
import { generateText } from "ai";
import { createTogetherClient, DEFAULT_MODEL } from "@/lib/utils/together";
import { extractJson } from "@/lib/utils/xml";
import { debugLog } from "@/lib/utils/debug";

// Force Node.js runtime (not Edge) for native modules
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/grade-short-answer
export async function POST(request: NextRequest) {
  debugLog.log("[API] /api/grade-short-answer - Request received", {
    timestamp: new Date().toISOString(),
  });
  
  try {
    // Get API key from headers
    const apiKey = request.headers.get("X-Together-API-Key");
    if (!apiKey) {
      debugLog.error("[API] Missing API key in request");
      return Response.json(
        { error: "Together AI API key is required" },
        { status: 401 }
      );
    }

    debugLog.log("[API] API key present, parsing request body");
    const body = await request.json();
    const { userAnswer, correctAnswer, content, info, question } = body;

    debugLog.log("[API] Request body parsed", {
      userAnswerLength: userAnswer?.length,
      correctAnswerLength: correctAnswer?.length,
      contentLength: content?.length,
      infoLength: info?.length,
      questionLength: question?.length,
    });

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

    debugLog.log("[API] Validation passed, creating Together client and calling LLM");
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
    
    const llmDuration = Date.now() - llmStartTime;
    debugLog.log("[API] LLM response received", {
      duration: `${llmDuration}ms`,
      responseLength: result.text.length,
      responsePreview: result.text.substring(0, 200),
    });

    try {
      // Extract JSON from response (in case there's extra text)
      debugLog.log("[API] Extracting JSON from LLM response");
      const jsonText = extractJson(result.text);
      debugLog.log("[API] Extracted JSON:", jsonText.substring(0, 200));
      const evaluation = JSON.parse(jsonText);
      debugLog.log("[API] Parsed evaluation", {
        isCorrect: evaluation.isCorrect,
        hasExplanation: !!evaluation.explanation,
      });

      // Validate the response structure
      if (typeof evaluation.isCorrect !== "boolean") {
        debugLog.error("[API] Invalid response format", evaluation);
        throw new Error("Invalid response format: isCorrect must be boolean");
      }

      debugLog.log("[API] Returning successful response", {
        isCorrect: evaluation.isCorrect,
        totalDuration: `${Date.now() - llmStartTime}ms`,
      });

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

