"use client";

import { useEffect, useRef, useState } from "react";
import { DragDropQuestion } from "./drag-drop-question";
import { FlowDiagram } from "./flow-diagram";
import type { FlowConfig } from "@/lib/types";

type QuestionType = "short-answer" | "true-false" | "multiple-choice" | "drag-drop" | "flow-diagram";

interface GradingResult {
  isCorrect: boolean;
  gradedAt: string;
}

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number | number[];
  title: string;
  questionType: QuestionType;
  choices?: string[];
  slots?: string[];
  flowConfig?: FlowConfig;
  gradingResult?: GradingResult;
}

interface Lesson {
  success: boolean;
  data: LessonData;
}

interface Module {
  title: string;
  lessons: Lesson[];
}

type Step = "module-intro" | "content" | "question" | "answer";

interface LessonScreenProps {
  step: Step;
  moduleIndex: number;
  moduleTitle: string;
  lessonData: LessonData;
  successfulLessonsCount: number;
  userAnswer: string | boolean | number | number[] | null;
  showResult: boolean;
  isGrading?: boolean;
  gradingError?: string | null;
  onAnswerChange: (answer: string | boolean | number | number[]) => void;
  canContinue: boolean;
  onContinue: () => void;
  onRetryGrading?: () => void;
  getButtonText: () => string;
}

function LessonScreen({
  step,
  moduleIndex,
  moduleTitle,
  lessonData,
  successfulLessonsCount,
  userAnswer,
  showResult,
  isGrading = false,
  gradingError = null,
  onAnswerChange,
  canContinue,
  onContinue,
  onRetryGrading,
  getButtonText,
}: LessonScreenProps) {
  const hasPlayedInitialAnimation = useRef(false);
  const shouldAnimateOnLoad = !hasPlayedInitialAnimation.current;
  const [showFlowHint, setShowFlowHint] = useState(false);

  useEffect(() => {
    hasPlayedInitialAnimation.current = true;
  }, []);

  // Reset flow hint when step changes
  useEffect(() => {
    if (step !== "question") {
      setShowFlowHint(false);
    }
  }, [step]);

  const animateClass = (condition = true) =>
    shouldAnimateOnLoad && condition ? "animate-fadeInUp" : "";

  return (
    <>
      {step === "module-intro" && (
        <div>
          <h1 className={`text-3xl font-bold text-neutral-900 mb-8 ${animateClass()}`}>
            Welcome to Module {moduleIndex + 1}! Let&apos;s start with{" "}
            {moduleTitle.toLowerCase()}
          </h1>
          <p
            className={`text-lg text-neutral-600 leading-relaxed ${animateClass()}`}
            style={{ animationDelay: "0.1s" }}
          >
            This module contains {successfulLessonsCount} interactive lessons
            about {moduleTitle.toLowerCase()}.
          </p>
        </div>
      )}

      {step === "content" && (
        <div className="space-y-8">
          <h1 className={`text-2xl font-bold text-neutral-900 ${animateClass()}`}>
            {lessonData.title}
          </h1>
          <p
            className={`text-lg text-neutral-800 leading-relaxed ${animateClass()}`}
            style={{ animationDelay: "0.1s" }}
          >
            {lessonData.content}
          </p>
          <div
            className={`bg-pink-50 border border-pink-200 rounded-2xl p-6 ${animateClass()}`}
            style={{ animationDelay: "0.2s" }}
          >
            <p className="text-neutral-800 leading-relaxed">{lessonData.info}</p>
          </div>

          {/* Show Flow Diagram for flow-diagram questions */}
          {lessonData.questionType === "flow-diagram" && lessonData.flowConfig && (
            <div
              className={`bg-blue-50 border-2 border-blue-200 rounded-xl p-6 ${animateClass()}`}
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-blue-900">
                  Study this process flow carefully — you'll be tested on the sequence!
                </h3>
              </div>
              <div style={{ height: '500px', minHeight: '500px' }}>
                <FlowDiagram config={lessonData.flowConfig} />
              </div>
            </div>
          )}
        </div>
      )}

      {(step === "question" || step === "answer") && (
        <div className="space-y-8">
          <h1 className={`text-2xl font-bold text-neutral-900 ${animateClass(!showResult)}`}>
            {lessonData.title}
          </h1>
          <p
            className={`text-lg text-neutral-800 leading-relaxed ${animateClass(!showResult)}`}
            style={!showResult ? { animationDelay: "0.1s" } : {}}
          >
            {lessonData.content}
          </p>
          <div
            className={`bg-pink-50 border border-pink-200 rounded-2xl p-6 ${animateClass(!showResult)}`}
            style={!showResult ? { animationDelay: "0.2s" } : {}}
          >
            <p className="text-neutral-800 leading-relaxed">{lessonData.info}</p>
          </div>

          <div className="pt-4">
            <p
              className={`text-lg font-medium text-neutral-900 mb-6 ${animateClass(!showResult)}`}
              style={!showResult ? { animationDelay: "0.3s" } : {}}
            >
              {lessonData.question}
            </p>

            {/* Multiple Choice */}
            {lessonData.questionType === "multiple-choice" &&
              lessonData.choices && (
                <div
                  className={`space-y-3 ${animateClass(!showResult)}`}
                  style={!showResult ? { animationDelay: "0.4s" } : {}}
                >
                  {lessonData.choices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => !showResult && onAnswerChange(idx)}
                      disabled={showResult}
                      className={`w-full text-left p-5 rounded-xl transition-all flex items-center gap-4 ${
                        userAnswer === idx
                          ? showResult
                            ? idx === lessonData.answer
                              ? "bg-green-100 border-2 border-green-400"
                              : "bg-red-100 border-2 border-red-400"
                            : "bg-blue-50 border-2 border-blue-400"
                          : showResult && idx === lessonData.answer
                          ? "bg-green-100 border-2 border-green-400"
                          : "bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          userAnswer === idx
                            ? "border-neutral-600"
                            : "border-neutral-400"
                        }`}
                      >
                        {userAnswer === idx && (
                          <div className="w-3 h-3 rounded-full bg-neutral-600" />
                        )}
                      </div>
                      <span className="text-neutral-800 flex-1">{choice}</span>
                    </button>
                  ))}
                </div>
              )}

            {/* True/False */}
            {lessonData.questionType === "true-false" && (
              <div
                className={`space-y-3 ${animateClass(!showResult)}`}
                style={!showResult ? { animationDelay: "0.4s" } : {}}
              >
                {[true, false].map((value) => (
                  <button
                    key={value.toString()}
                    onClick={() => !showResult && onAnswerChange(value)}
                    disabled={showResult}
                    className={`w-full text-left p-5 rounded-xl transition-all flex items-center gap-4 ${
                      userAnswer === value
                        ? showResult
                          ? value === lessonData.answer
                            ? "bg-green-100 border-2 border-green-400"
                            : "bg-red-100 border-2 border-red-400"
                          : "bg-blue-50 border-2 border-blue-400"
                        : showResult && value === lessonData.answer
                        ? "bg-green-100 border-2 border-green-400"
                        : "bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        userAnswer === value
                          ? "border-neutral-600"
                          : "border-neutral-400"
                      }`}
                    >
                      {userAnswer === value && (
                        <div className="w-3 h-3 rounded-full bg-neutral-600" />
                      )}
                    </div>
                    <span className="text-neutral-800 font-medium">
                      {value ? "True" : "False"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {lessonData.questionType === "short-answer" && (
              <div
                className={animateClass(!showResult)}
                style={!showResult ? { animationDelay: "0.4s" } : {}}
              >
                <textarea
                  value={(userAnswer as string) || ""}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  disabled={showResult || isGrading}
                  placeholder="Type your answer here..."
                  className={`w-full p-5 border-2 rounded-xl focus:outline-none resize-none text-neutral-800 bg-neutral-50 transition-all ${
                    showResult && lessonData.gradingResult
                      ? lessonData.gradingResult.isCorrect
                        ? "border-green-400 bg-green-50"
                        : "border-red-400 bg-red-50"
                      : showResult
                      ? "border-neutral-200"
                      : "border-neutral-200 focus:border-blue-400"
                  }`}
                  rows={4}
                />
                {gradingError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-700 mb-2">
                      Error grading answer
                    </p>
                    <p className="text-red-600 text-sm mb-3">{gradingError}</p>
                    {onRetryGrading && (
                      <button
                        onClick={onRetryGrading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
                {showResult && lessonData.gradingResult && (
                  <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-semibold text-neutral-700 mb-2">
                      Answer:
                    </p>
                    <p className="text-neutral-800 leading-relaxed">
                      {lessonData.answer}
                    </p>
                  </div>
                )}
                {showResult && !lessonData.gradingResult && !isGrading && !gradingError && (
                  <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-semibold text-neutral-700 mb-2">
                      Answer:
                    </p>
                    <p className="text-neutral-800 leading-relaxed">
                      {lessonData.answer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Drag Drop */}
            {lessonData.questionType === "drag-drop" &&
              lessonData.choices &&
              lessonData.slots && (
                <div
                  className={animateClass(!showResult)}
                  style={!showResult ? { animationDelay: "0.4s" } : {}}
                >
                  <DragDropQuestion
                    choices={lessonData.choices}
                    slots={lessonData.slots}
                    correctAnswer={lessonData.answer as number[]}
                    userAnswer={(userAnswer as number[]) || null}
                    showResult={showResult}
                    onAnswerChange={onAnswerChange}
                  />
                </div>
              )}

            {/* Flow Diagram */}
            {lessonData.questionType === "flow-diagram" &&
              lessonData.flowConfig &&
              lessonData.choices &&
              lessonData.slots && (
                <div
                  className={animateClass(!showResult)}
                  style={!showResult ? { animationDelay: "0.4s" } : {}}
                >
                  {/* Flow Visualization Hint */}
                  {!showResult && !showFlowHint && (
                    <div className="mb-6">
                      <button
                        onClick={() => setShowFlowHint(true)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Show Flow Diagram (Hint)
                      </button>
                    </div>
                  )}

                  {/* Flow Visualization (shown as hint or after answer) */}
                  {(showFlowHint || showResult) && (
                    <div className="mb-8 bg-neutral-50 border-2 border-neutral-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-neutral-700">
                          Process Flow:
                        </h3>
                        {!showResult && showFlowHint && (
                          <button
                            onClick={() => setShowFlowHint(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Hide
                          </button>
                        )}
                      </div>
                      <div style={{ height: '500px', minHeight: '500px' }}>
                        <FlowDiagram config={lessonData.flowConfig} />
                      </div>
                    </div>
                  )}
                  
                  {/* Drag-Drop Question */}
                  <DragDropQuestion
                    choices={lessonData.choices}
                    slots={lessonData.slots}
                    correctAnswer={lessonData.answer as number[]}
                    userAnswer={(userAnswer as number[]) || null}
                    showResult={showResult}
                    onAnswerChange={onAnswerChange}
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div
        className={`mt-12 ${animateClass(step === "module-intro" || step === "content" || !showResult)}`}
        style={
          step === "module-intro" || step === "content" || !showResult
            ? { animationDelay: "0.5s" }
            : {}
        }
      >
        <button
          onClick={onContinue}
          disabled={!canContinue || isGrading}
          className={`px-8 py-3 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
            canContinue && !isGrading
              ? "bg-neutral-700 text-white hover:bg-neutral-800 active:scale-95"
              : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
          }`}
        >
          {isGrading && (
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {isGrading ? "Grading..." : getButtonText()}
        </button>
      </div>

      {/* Debug Info (Local Development Only) */}
      {process.env.NODE_ENV === 'development' && lessonData && step !== "module-intro" && (
        <div className="mt-12 p-6 bg-neutral-100 border border-neutral-300 rounded-xl">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">
            Debug: Lesson JSON (Local Only)
          </h3>
          <pre className="text-xs text-neutral-800 overflow-auto max-h-96 whitespace-pre-wrap break-words">
            {JSON.stringify(lessonData, null, 2)}
          </pre>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </>
  );
}


export { LessonScreen };
