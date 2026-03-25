"use client";

import type { FlowConfig } from "@/lib/types";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number | number[];
  title: string;
  questionType: string;
  choices?: string[];
  slots?: string[];
  flowConfig?: FlowConfig;
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
    <div className="text-center">
      {/* Celebration Image */}
      <div className="mb-4 flex justify-center animate-scaleIn">
        <img 
          src="/great-work.svg" 
          alt="Great Work"
          className="h-auto w-auto"
        />
      </div>

      <h1 className="text-3xl font-bold text-neutral-900 mb-2 animate-fadeInUp">
        Module {moduleIndex + 1} - Complete
      </h1>
      <p className="text-lg text-neutral-600 mb-6 leading-relaxed animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        Good work—your {moduleTitle.toLowerCase()} basics are locked in.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3 mb-8 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        {hasNextModule ? (
          <button
            onClick={onContinue}
            className="px-8 py-4 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 flex items-center gap-2 transition-all active:scale-95"
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
            className="px-8 py-4 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 flex items-center gap-2 transition-all active:scale-95"
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
      <div className="max-w-md mx-auto text-left animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-neutral-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {moduleStats.total > 0
                ? Math.round((moduleStats.correct / moduleStats.total) * 100)
                : 100}%
            </div>
            <div className="text-xs text-neutral-500">Accuracy</div>
          </div>
          <div className="bg-neutral-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-neutral-900 mb-1">
              {moduleStats.correct}/{moduleStats.total}
            </div>
            <div className="text-xs text-neutral-500">Correct</div>
          </div>
          <div className="bg-neutral-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-neutral-900 mb-1">
              {Math.max(1, Math.round((Date.now() - moduleStats.startTime) / 60000))}m
            </div>
            <div className="text-xs text-neutral-500">Time</div>
          </div>
        </div>

        {/* Topics covered */}
        <div className="bg-neutral-50 rounded-xl p-4">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Topics covered</h3>
          <div className="flex flex-wrap gap-2">
            {successfulLessons.map((lesson, idx) => (
              <span key={idx} className="inline-flex items-center px-3 py-1.5 bg-white border border-neutral-200 rounded-full text-xs text-neutral-700">
                {lesson.data.title}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
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
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          opacity: 0;
          animation-fill-mode: forwards;
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

export { ModuleCompleteScreen };
