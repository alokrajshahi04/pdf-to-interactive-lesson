"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Eye, X, Info } from "lucide-react";
import { DragDropQuestion } from "./drag-drop-question";
import { FlowDiagram } from "./flow-diagram";
import { Button } from "./ui/button";
import { Callout } from "./ui/callout";
import { Loader } from "@/components/ai-elements/loader";
import type { LessonData, Step } from "@/lib/types";

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

const OPTION_TRANSITION =
  "transition-[background-color,border-color,box-shadow] duration-200 ease-standard";

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
  const [hasAnimated, setHasAnimated] = useState(false);
  const shouldAnimateOnLoad = !hasAnimated;
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setHasAnimated(true);
  }, []);

  useEffect(() => {
    if (step !== "question" && step !== "answer") {
      setShowHint(false);
    }
    if (step !== "answer") {
      setShowAnswer(false);
    }
  }, [step]);

  const animateClass = (condition = true) =>
    shouldAnimateOnLoad && condition ? "animate-fadeInUp" : "";

  const renderIncorrectSlots = () => {
    if (!showResult || !lessonData.choices || !lessonData.slots) return null;
    const correctAnswer = lessonData.answer as number[];
    const currentUserAnswer = (userAnswer as number[]) || [];
    const incorrectSlots = lessonData.slots
      .map((slot, slotIndex) => {
        const assignedChoiceIndex = currentUserAnswer[slotIndex] ?? -1;
        if (assignedChoiceIndex !== correctAnswer[slotIndex]) {
          return { slotIndex, correctChoice: lessonData.choices![correctAnswer[slotIndex]] };
        }
        return null;
      })
      .filter(Boolean);

    if (incorrectSlots.length === 0) return null;

    return (
      <Callout variant="info" title="Correct answers" className="mt-4">
        <div className="space-y-2">
          {incorrectSlots.map((item) => (
            <div key={item!.slotIndex} className="flex items-start gap-2">
              <span className="text-sm font-medium text-neutral-600 min-w-[24px]">
                {item!.slotIndex + 1}.
              </span>
              <span className="text-sm text-neutral-800">{item!.correctChoice}</span>
            </div>
          ))}
        </div>
      </Callout>
    );
  };

  return (
    <>
      {step === "module-intro" && (
        <div>
          <h1 className={`text-3xl font-bold text-neutral-900 mb-8 ${animateClass()}`}>
            Welcome to Module {moduleIndex + 1}! Let&rsquo;s start with{" "}
            {moduleTitle.toLowerCase()}
          </h1>
          <p
            className={`text-lg text-neutral-600 leading-relaxed ${animateClass()}`}
            style={{ animationDelay: "0.1s" }}
          >
            This module contains {successfulLessonsCount} interactive lessons about{" "}
            {moduleTitle.toLowerCase()}.
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
          <Callout
            variant="hint"
            className={animateClass()}
            style={{ animationDelay: "0.2s" }}
          >
            {lessonData.info}
          </Callout>

          {lessonData.questionType === "flow-diagram" && lessonData.flowConfig && (
            <Callout
              variant="info"
              icon={<Info className="w-5 h-5 text-info" />}
              title="Study this process flow carefully — you’ll be tested on the sequence!"
              className={`border-2 ${animateClass()}`}
              style={{ animationDelay: "0.3s" }}
            >
              <div className="h-[360px] sm:h-[500px]">
                <FlowDiagram config={lessonData.flowConfig} />
              </div>
            </Callout>
          )}
        </div>
      )}

      {(step === "question" || step === "answer") && (
        <div className="space-y-8">
          <h1 className={`text-2xl font-bold text-neutral-900 ${animateClass(!showResult)}`}>
            {lessonData.title}
          </h1>

          {/* Hint toggle — the button stays put and flips to "Hide hint";
              the hint appears directly beneath it. */}
          {!showResult && (
            <div className={animateClass(!showResult)} style={!showResult ? { animationDelay: "0.1s" } : {}}>
              <button
                onClick={() => setShowHint((v) => !v)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-hint-bg text-hint-fg border border-hint-border hover:brightness-95 text-sm font-medium ${OPTION_TRANSITION}`}
              >
                {showHint ? <X className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
                {showHint ? "Hide hint" : "Show hint"}
              </button>
              {showHint && (
                <Callout variant="hint" className="mt-3">
                  {lessonData.info}
                </Callout>
              )}
            </div>
          )}

          {/* Show answer toggle */}
          {showResult && !showAnswer && (
            <div>
              <button
                onClick={() => setShowAnswer(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-info-bg text-info-fg border border-info-border hover:brightness-95 text-sm font-medium ${OPTION_TRANSITION}`}
              >
                <Eye className="w-4 h-4" />
                Show answer
              </button>
            </div>
          )}

          {showResult && showAnswer && (
            <>
              <p className="text-lg text-neutral-800 leading-relaxed">{lessonData.content}</p>
              <Callout variant="hint">{lessonData.info}</Callout>
            </>
          )}

          <div className="pt-4">
            <p
              className={`text-lg font-medium text-neutral-900 mb-6 ${animateClass(!showResult)}`}
              style={!showResult ? { animationDelay: "0.2s" } : {}}
            >
              {lessonData.question}
            </p>

            {/* Multiple Choice */}
            {lessonData.questionType === "multiple-choice" && lessonData.choices && (
              <div
                className={`space-y-3 ${animateClass(!showResult)}`}
                style={!showResult ? { animationDelay: "0.3s" } : {}}
              >
                {lessonData.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => !showResult && onAnswerChange(idx)}
                    disabled={showResult}
                    className={`w-full text-left p-5 rounded-xl flex items-center gap-4 ${OPTION_TRANSITION} ${
                      userAnswer === idx
                        ? showResult
                          ? idx === lessonData.answer
                            ? "bg-correct-bg border-2 border-correct"
                            : "bg-incorrect-bg border-2 border-incorrect"
                          : "bg-info-bg border-2 border-info"
                        : showResult && idx === lessonData.answer
                        ? "bg-correct-bg border-2 border-correct"
                        : "bg-surface-muted border-2 border-border hover:border-border-strong"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        userAnswer === idx ? "border-neutral-600" : "border-neutral-400"
                      }`}
                    >
                      {userAnswer === idx && <div className="w-3 h-3 rounded-full bg-neutral-600" />}
                    </div>
                    <span className="text-neutral-800 flex-1">
                      {typeof choice === "string"
                        ? choice.replace(/\s*\((?:CORRECT|correct|Correct)\)\s*/g, "").trim()
                        : choice}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* MC Explanation */}
            {lessonData.questionType === "multiple-choice" &&
              showResult &&
              showAnswer &&
              lessonData.explanation && (
                <Callout variant="info" title="Explanation" className="mt-4">
                  <p className="text-neutral-800 leading-relaxed">{lessonData.explanation}</p>
                </Callout>
              )}

            {/* True/False */}
            {lessonData.questionType === "true-false" && (
              <div
                className={`space-y-3 ${animateClass(!showResult)}`}
                style={!showResult ? { animationDelay: "0.3s" } : {}}
              >
                {[true, false].map((value) => (
                  <button
                    key={value.toString()}
                    onClick={() => !showResult && onAnswerChange(value)}
                    disabled={showResult}
                    className={`w-full text-left p-5 rounded-xl flex items-center gap-4 ${OPTION_TRANSITION} ${
                      userAnswer === value
                        ? showResult
                          ? value === lessonData.answer
                            ? "bg-correct-bg border-2 border-correct"
                            : "bg-incorrect-bg border-2 border-incorrect"
                          : "bg-info-bg border-2 border-info"
                        : showResult && value === lessonData.answer
                        ? "bg-correct-bg border-2 border-correct"
                        : "bg-surface-muted border-2 border-border hover:border-border-strong"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        userAnswer === value ? "border-neutral-600" : "border-neutral-400"
                      }`}
                    >
                      {userAnswer === value && <div className="w-3 h-3 rounded-full bg-neutral-600" />}
                    </div>
                    <span className="text-neutral-800 font-medium">{value ? "True" : "False"}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {lessonData.questionType === "short-answer" && (
              <div
                className={animateClass(!showResult)}
                style={!showResult ? { animationDelay: "0.3s" } : {}}
              >
                <textarea
                  value={(userAnswer as string) || ""}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  disabled={showResult || isGrading}
                  placeholder="Type your answer here..."
                  className={`w-full p-5 border-2 rounded-xl focus:outline-none resize-none text-neutral-800 bg-surface-muted transition-[border-color,background-color] duration-200 ease-standard ${
                    showResult && lessonData.gradingResult
                      ? lessonData.gradingResult.isCorrect
                        ? "border-correct bg-correct-bg"
                        : "border-incorrect bg-incorrect-bg"
                      : showResult
                      ? "border-border"
                      : "border-border focus:border-info"
                  }`}
                  rows={4}
                />
                {gradingError && (
                  <Callout
                    variant="incorrect"
                    title="Error grading answer"
                    className="mt-4"
                    action={
                      onRetryGrading ? (
                        <Button variant="danger" size="sm" shape="lg" onClick={onRetryGrading}>
                          Retry
                        </Button>
                      ) : undefined
                    }
                  >
                    <p className="text-sm">{gradingError}</p>
                  </Callout>
                )}
                {showResult && showAnswer && !isGrading && !gradingError && (
                  <Callout variant="info" title="Answer" className="mt-4">
                    <p className="text-neutral-800 leading-relaxed">{lessonData.answer}</p>
                  </Callout>
                )}
              </div>
            )}

            {/* Drag Drop */}
            {lessonData.questionType === "drag-drop" && lessonData.choices && lessonData.slots && (
              <div
                className={animateClass(!showResult)}
                style={!showResult ? { animationDelay: "0.3s" } : {}}
              >
                <DragDropQuestion
                  choices={lessonData.choices}
                  slots={lessonData.slots}
                  correctAnswer={lessonData.answer as number[]}
                  userAnswer={(userAnswer as number[]) || null}
                  showResult={showResult}
                  onAnswerChange={onAnswerChange}
                />
                {showAnswer && renderIncorrectSlots()}
              </div>
            )}

            {/* Flow Diagram question */}
            {lessonData.questionType === "flow-diagram" &&
              lessonData.flowConfig &&
              lessonData.choices &&
              lessonData.slots && (
                <div
                  className={animateClass(!showResult)}
                  style={!showResult ? { animationDelay: "0.3s" } : {}}
                >
                  {(showHint || (showResult && showAnswer)) && (
                    <div className="mb-8 bg-surface-muted border-2 border-border rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-neutral-700">Process flow</h3>
                        {!showResult && showHint && (
                          <button
                            onClick={() => setShowHint(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Hide
                          </button>
                        )}
                      </div>
                      <div className="h-[360px] sm:h-[500px]">
                        <FlowDiagram config={lessonData.flowConfig} />
                      </div>
                    </div>
                  )}

                  <DragDropQuestion
                    choices={lessonData.choices}
                    slots={lessonData.slots}
                    correctAnswer={lessonData.answer as number[]}
                    userAnswer={(userAnswer as number[]) || null}
                    showResult={showResult}
                    onAnswerChange={onAnswerChange}
                  />
                  {showAnswer && renderIncorrectSlots()}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Action button */}
      <div
        className={`mt-12 ${animateClass(step === "module-intro" || step === "content" || !showResult)}`}
        style={
          step === "module-intro" || step === "content" || !showResult
            ? { animationDelay: "0.5s" }
            : {}
        }
      >
        <Button size="lg" onClick={onContinue} disabled={!canContinue || isGrading}>
          {isGrading && <Loader size={18} />}
          {isGrading ? "Grading…" : getButtonText()}
        </Button>
      </div>

      {/* Debug Info (Local Development Only) */}
      {process.env.NODE_ENV === "development" && lessonData && step !== "module-intro" && (
        <div className="mt-12 p-6 bg-surface-muted border border-border rounded-xl">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">
            Debug: Lesson JSON (Local Only)
          </h3>
          <pre className="text-xs text-neutral-800 overflow-auto max-h-96 whitespace-pre-wrap break-words">
            {JSON.stringify(lessonData, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

export { LessonScreen };
