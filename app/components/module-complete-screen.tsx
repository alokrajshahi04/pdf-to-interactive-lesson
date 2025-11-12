"use client";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number | number[];
  title: string;
  questionType: string;
  choices?: string[];
  slots?: string[];
}

interface Lesson {
  success: boolean;
  data: LessonData;
}

interface Module {
  title: string;
  lessons: Lesson[];
}

interface ModuleCompleteScreenProps {
  moduleIndex: number;
  moduleTitle: string;
  moduleStats: {
    correct: number;
    total: number;
    startTime: number;
  };
  successfulLessons: Lesson[];
  hasNextModule: boolean;
  onContinue: () => void;
  onBackToModules: () => void;
}

function ModuleCompleteScreen({
  moduleIndex,
  moduleTitle,
  moduleStats,
  successfulLessons,
  hasNextModule,
  onContinue,
  onBackToModules,
}: ModuleCompleteScreenProps) {
  return (
    <div className="animate-fadeIn text-center">
      {/* Celebration Image */}
      <div className="mb-8 flex justify-center">
        <div className="relative">
          <div className="text-6xl mb-4">🎉</div>
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white border-2 border-gray-900 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap">
            Great Work
          </div>
        </div>
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Module {moduleIndex + 1} - Complete
      </h1>
      <p className="text-lg text-gray-600 mb-12">
        Good work—your {moduleTitle.toLowerCase()} basics are locked in.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4 mb-12">
        {hasNextModule ? (
          <button
            onClick={onContinue}
            className="px-8 py-4 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2"
          >
            Begin Module {moduleIndex + 2}
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        ) : (
          <button
            onClick={onBackToModules}
            className="px-8 py-4 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2"
          >
            View All Modules
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </button>
        )}
        <button className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-medium hover:border-gray-400 transition-all flex items-center gap-2">
          Share Course
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      {/* Statistics */}
      <div className="max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-2xl p-8 text-left">
        {/* Accuracy */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Accuracy:</span>
            <span className="text-green-600 font-bold">
              {moduleStats.total > 0
                ? Math.round((moduleStats.correct / moduleStats.total) * 100)
                : 100}
              %
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${
                  moduleStats.total > 0
                    ? (moduleStats.correct / moduleStats.total) * 100
                    : 100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Questions answered */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Questions answered:</span>
            <span className="text-green-600 font-bold">
              {moduleStats.total}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-full" />
          </div>
        </div>

        {/* Time spent */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Time spent:</span>
            <span className="text-gray-900 font-bold">
              {Math.round((Date.now() - moduleStats.startTime) / 60000)} min
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gray-700 w-1/3" />
          </div>
        </div>

        {/* What you covered */}
        <div>
          <h3 className="text-gray-600 mb-3">What you covered:</h3>
          <ul className="space-y-2">
            {successfulLessons.map((lesson, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-gray-900">•</span>
                <span className="text-gray-900">{lesson.data.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export { ModuleCompleteScreen };
