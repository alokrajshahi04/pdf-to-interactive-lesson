"use client";

import { useState } from "react";
import { DragDropQuestion } from "../components/drag-drop-question";

export default function TestDragDropPage() {
  const [userAnswer, setUserAnswer] = useState<number[] | null>(null);
  const [showResult, setShowResult] = useState(false);

  const choices = ["Option A", "Option B", "Option C"];
  const slots = ["Category 1", "Category 2", "Category 3"];
  const correctAnswer = [0, 2, 1]; // Slot 0 -> Choice 0, Slot 1 -> Choice 2, Slot 2 -> Choice 1

  const handleAnswerChange = (answer: number[]) => {
    setUserAnswer(answer);
  };

  const handleContinue = () => {
    if (!showResult) {
      setShowResult(true);
    } else {
      // Reset for testing
      setUserAnswer(null);
      setShowResult(false);
    }
  };

  const canContinue = () => {
    if (!showResult) {
      if (Array.isArray(userAnswer)) {
        return userAnswer.length === 3 && userAnswer.every((val) => val !== -1 && val !== null && val !== undefined);
      }
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Drag-Drop Question Test</h1>
        
        <div className="mb-6 p-4 bg-neutral-50 rounded-lg">
          <p className="text-sm text-neutral-600 mb-2">
            <strong>Instructions:</strong> Drag the choices to their correct slots.
          </p>
          <p className="text-sm text-neutral-600">
            <strong>Correct answer:</strong> Slot 0 → Choice 0 (Option A), Slot 1 → Choice 2 (Option C), Slot 2 → Choice 1 (Option B)
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Match the following items to their categories:</h2>
          <DragDropQuestion
            choices={choices}
            slots={slots}
            correctAnswer={correctAnswer}
            userAnswer={userAnswer}
            showResult={showResult}
            onAnswerChange={handleAnswerChange}
          />
          {/* Correct Answers Info Box */}
          {showResult && userAnswer && (() => {
            const incorrectSlots = slots.map((slot, slotIndex) => {
              const assignedChoiceIndex = userAnswer[slotIndex] ?? -1;
              const isCorrect = assignedChoiceIndex === correctAnswer[slotIndex];
              if (!isCorrect) {
                return {
                  slotIndex,
                  correctChoice: choices[correctAnswer[slotIndex]],
                };
              }
              return null;
            }).filter(Boolean);

            if (incorrectSlots.length === 0) return null;

            return (
              <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-neutral-700 mb-3">
                  Correct Answers:
                </p>
                <div className="space-y-2">
                  {incorrectSlots.map((item) => (
                    <div key={item!.slotIndex} className="flex items-start gap-2">
                      <span className="text-sm font-medium text-neutral-600 min-w-[24px]">
                        {item!.slotIndex + 1}.
                      </span>
                      <span className="text-sm text-neutral-800">
                        {item!.correctChoice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="mt-8">
          <button
            onClick={handleContinue}
            disabled={!canContinue()}
            className={`px-8 py-3 rounded-full font-medium transition-all ${
              canContinue()
                ? "bg-neutral-700 text-white hover:bg-neutral-800 active:scale-95"
                : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {showResult ? "Reset" : "Check Answer"}
          </button>
        </div>

        {userAnswer && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-neutral-700">Current Answer:</p>
            <p className="text-sm text-neutral-600">
              {JSON.stringify(userAnswer)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

