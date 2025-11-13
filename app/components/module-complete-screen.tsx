"use client";

import { useImageFadeIn } from "../hooks/use-image-fade-in";

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
  const greatWorkFadeIn = useImageFadeIn("/great-work.svg");
  
  return (
    <div className="animate-fadeIn text-center">
      {/* Celebration Image */}
      <div className="mb-4 flex justify-center">
        <img 
          ref={greatWorkFadeIn.imgRef}
          src="/great-work.svg" 
          alt="Great Work"
          onLoad={greatWorkFadeIn.handleLoad}
          onError={greatWorkFadeIn.handleError}
          className={`h-auto w-auto transition-opacity duration-700 ease-out ${greatWorkFadeIn.isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      <h1 className="text-3xl font-bold text-neutral-900 mb-2">
        Module {moduleIndex + 1} - Complete
      </h1>
      <p className="text-base text-neutral-600 mb-6">
        Good work—your {moduleTitle.toLowerCase()} basics are locked in.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3 mb-8">
        {hasNextModule ? (
          <button
            onClick={onContinue}
            className="px-8 py-4 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-all flex items-center gap-2"
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
            className="px-8 py-4 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-all flex items-center gap-2"
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
      </div>

      {/* Statistics */}
      <div className="max-w-md mx-auto bg-neutral-50 rounded-2xl p-6 text-left">
        {/* Accuracy */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-600">Accuracy:</span>
            <span className="text-sm text-green-600 font-semibold">
              {moduleStats.total > 0
                ? Math.round((moduleStats.correct / moduleStats.total) * 100)
                : 100}
              %
            </span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
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
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-600">Questions answered:</span>
            <span className="text-sm text-green-600 font-semibold">
              {moduleStats.total}
            </span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-full" />
          </div>
        </div>

        {/* Time spent */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-600">Time spent:</span>
            <span className="text-sm text-neutral-900 font-semibold">
              {Math.round((Date.now() - moduleStats.startTime) / 60000)} min
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="bg-[#E5E5E5] -mx-6 my-4" style={{ width: 'calc(100% + 3rem)', height: '0.5px' }}></div>

        {/* What you covered */}
        <div>
          <h3 className="text-sm text-neutral-600 mb-3">What you covered:</h3>
          <ul className="space-y-2">
            {successfulLessons.map((lesson, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-neutral-900 text-sm">•</span>
                <span className="text-sm text-neutral-900">{lesson.data.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export { ModuleCompleteScreen };
