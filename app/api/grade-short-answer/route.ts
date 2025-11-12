import { NextRequest } from "next/server";
import { generateText } from "ai";
import { createTogetherClient, DEFAULT_MODEL } from "@/lib/utils/together";
import { extractJson } from "@/lib/utils/xml";

// Force Node.js runtime (not Edge) for native modules
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/grade-short-answer
export async function POST(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get("X-Together-API-Key");
    if (!apiKey) {
      return Response.json(
        { error: "Together AI API key is required" },
        { status: 401 }
      );
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
      return Response.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    const together = createTogetherClient(apiKey);

    // Use LLM to evaluate if the user's answer demonstrates understanding
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
        throw new Error("Invalid response format: isCorrect must be boolean");
      }

      return Response.json({
        isCorrect: evaluation.isCorrect,
        explanation: evaluation.explanation || undefined,
      });
    } catch (error) {
      console.error("Failed to parse evaluation response:", result.text);
      return Response.json(
        {
          error: "Failed to evaluate answer - invalid response format",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error grading short answer:", error);
    return Response.json(
      {
        error: "Failed to grade answer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

