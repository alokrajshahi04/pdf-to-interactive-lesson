"use client";

type QuestionType = "short-answer" | "true-false" | "multiple-choice";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number;
  title: string;
  questionType: QuestionType;
  choices?: string[];
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
  onAnswerChange: (answer: string | boolean | number) => void;
  canContinue: boolean;
  onContinue: () => void;
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
  onAnswerChange,
  canContinue,
  onContinue,
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
                  disabled={showResult}
                  placeholder="Type your answer here..."
                  className="w-full p-5 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none resize-none text-gray-800 bg-gray-50"
                  rows={4}
                />
                {showResult && (
                  <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Suggested Answer:
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
          disabled={!canContinue}
          className={`px-8 py-3 rounded-full font-medium transition-all ${
            canContinue
              ? "bg-gray-700 text-white hover:bg-gray-800 active:scale-95"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {getButtonText()}
        </button>
      </div>
    </>
  );
}

export { LessonScreen };
