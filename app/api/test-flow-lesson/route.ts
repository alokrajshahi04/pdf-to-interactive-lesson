import { NextResponse } from "next/server";
import { createLessons } from "@/lib/create-lesson";
import type { Module } from "@/lib/types";

export async function GET() {
  const API_KEY = process.env.TOGETHER_API_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      { error: "TOGETHER_API_KEY not configured" },
      { status: 500 }
    );
  }

  const testModule: Module = {
    title: "Photosynthesis Process",
  };

  const testContent = `
Photosynthesis is the process by which plants convert light energy into chemical energy. The process occurs in two main stages: the light-dependent reactions and the Calvin cycle.

The light-dependent reactions begin when photons are captured by chlorophyll molecules in Photosystem II (PS II). This excites electrons, which then pass through an electron transport chain containing cytochrome b6f. The excited electrons eventually reach Photosystem I (PS I), where they gain more energy from additional light.

As electrons move through PS II, water molecules are split in a process called photolysis, releasing oxygen gas as a byproduct. The electron transport creates a proton gradient across the thylakoid membrane. This gradient drives ATP synthesis through ATP synthase, often called chemiosmosis.

Meanwhile, PS I uses the energized electrons to reduce NADP+ to NADPH. Both ATP and NADPH are then used in the Calvin cycle to fix carbon dioxide into glucose.

The entire process is a coordinated flow: light capture → electron excitation → water splitting → electron transport → proton gradient → ATP/NADPH production → carbon fixation.
`;

  try {
    console.log("🧪 Testing flow lesson generation...");
    
    const result = await createLessons({
      module: testModule,
      content: testContent,
      apiKey: API_KEY,
      validateStructure: true,
      validateContent: false, // Skip content validation for faster testing
      retryFailures: false,
    });

    // Find the flow diagram lesson
    const flowLesson = result.lessons.find(
      (l) => l.success && l.data.questionType === "flow-diagram"
    );

    if (!flowLesson || !flowLesson.success) {
      return NextResponse.json({
        success: false,
        message: "No flow diagram lesson was generated",
        allLessons: result.lessons.map((l) => ({
          success: l.success,
          type: l.success ? l.data.questionType : "failed",
          title: l.success ? l.data.title : "Failed lesson",
        })),
      });
    }

    return NextResponse.json({
      success: true,
      lesson: flowLesson.data,
    });
  } catch (error) {
    console.error("Error generating flow lesson:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate flow lesson",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}


