"use client";

type QuestionType = "short-answer" | "true-false" | "multiple-choice";

interface GradingResult {
  isCorrect: boolean;
  gradedAt: string;
}

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number;
  title: string;
  questionType: QuestionType;
  choices?: string[];
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
  userAnswer: string | boolean | number | null;
  showResult: boolean;
  isGrading?: boolean;
  gradingError?: string | null;
  onAnswerChange: (answer: string | boolean | number) => void;
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
  return (
    <>
      {step === "module-intro" && (
        <div className="animate-fadeIn">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Welcome to Module {moduleIndex + 1}! Let&apos;s start with{" "}
            {moduleTitle.toLowerCase()}
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            This module contains {successfulLessonsCount} interactive lessons
            about {moduleTitle.toLowerCase()}.
          </p>
        </div>
      )}

      {step === "content" && (
        <div className="animate-fadeIn space-y-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {lessonData.title}
          </h1>
          <p className="text-lg text-gray-800 leading-relaxed">
            {lessonData.content}
          </p>
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-6">
            <p className="text-gray-800 leading-relaxed">{lessonData.info}</p>
          </div>
        </div>
      )}

      {(step === "question" || step === "answer") && (
        <div className="animate-fadeIn space-y-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {lessonData.title}
          </h1>
          <p className="text-lg text-gray-800 leading-relaxed">
            {lessonData.content}
          </p>
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-6">
            <p className="text-gray-800 leading-relaxed">{lessonData.info}</p>
          </div>

          <div className="pt-4">
            <p className="text-lg font-medium text-gray-900 mb-6">
              {lessonData.question}
            </p>

            {/* Multiple Choice */}
            {lessonData.questionType === "multiple-choice" &&
              lessonData.choices && (
                <div className="space-y-3">
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
                          : "bg-gray-100 border-2 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          userAnswer === idx
                            ? "border-gray-600"
                            : "border-gray-400"
                        }`}
                      >
                        {userAnswer === idx && (
                          <div className="w-3 h-3 rounded-full bg-gray-600" />
                        )}
                      </div>
                      <span className="text-gray-800 flex-1">{choice}</span>
                    </button>
                  ))}
                </div>
              )}

            {/* True/False */}
            {lessonData.questionType === "true-false" && (
              <div className="space-y-3">
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
                        : "bg-gray-100 border-2 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        userAnswer === value
                          ? "border-gray-600"
                          : "border-gray-400"
                      }`}
                    >
                      {userAnswer === value && (
                        <div className="w-3 h-3 rounded-full bg-gray-600" />
                      )}
                    </div>
                    <span className="text-gray-800 font-medium">
                      {value ? "True" : "False"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {lessonData.questionType === "short-answer" && (
              <div>
                <textarea
                  value={(userAnswer as string) || ""}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  disabled={showResult || isGrading}
                  placeholder="Type your answer here..."
                  className={`w-full p-5 border-2 rounded-xl focus:outline-none resize-none text-gray-800 bg-gray-50 transition-all ${
                    showResult && lessonData.gradingResult
                      ? lessonData.gradingResult.isCorrect
                        ? "border-green-400 bg-green-50"
                        : "border-red-400 bg-red-50"
                      : showResult
                      ? "border-gray-200"
                      : "border-gray-200 focus:border-blue-400"
                  }`}
                  rows={4}
                />
                {isGrading && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600"
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
                    <span className="text-gray-700">Grading your answer...</span>
                  </div>
                )}
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
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Answer:
                    </p>
                    <p className="text-gray-800 leading-relaxed">
                      {lessonData.answer}
                    </p>
                  </div>
                )}
                {showResult && !lessonData.gradingResult && !isGrading && !gradingError && (
                  <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Answer:
                    </p>
                    <p className="text-gray-800 leading-relaxed">
                      {lessonData.answer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-12">
        <button
          onClick={onContinue}
          disabled={!canContinue || isGrading}
          className={`px-8 py-3 rounded-full font-medium transition-all ${
            canContinue && !isGrading
              ? "bg-gray-700 text-white hover:bg-gray-800 active:scale-95"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isGrading ? "Grading..." : getButtonText()}
        </button>
      </div>
    </>
  );
}

export { LessonScreen };
