"use client";

import { useState } from "react";
import { Header } from "./header";
import { Footer } from "./footer";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number;
  title: string;
  questionType: string;
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

interface Course {
  title: string;
  modules: Module[];
}

interface ModulesScreenProps {
  course: Course;
  onStartModule: (moduleIndex: number) => void;
  completedModules: number[];
  currentModuleIndex: number;
}

function ModulesScreen({
  course,
  onStartModule,
  completedModules,
  currentModuleIndex,
}: ModulesScreenProps) {
  const [copied, setCopied] = useState(false);

  const totalModules = course.modules.length;
  const totalLessons = course.modules.reduce(
    (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
    0
  );

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(course, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Course Title Header */}
      <div className="border-b border-gray-200 bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-2xl font-semibold text-gray-900 text-center">
            {course.title}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left Column - Course Overview */}
          <div className="flex flex-col justify-center">
            <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              We built your course!
            </h2>
            <p className="text-lg text-gray-600 mb-12 leading-relaxed">
              Explore the {totalModules} bite-sized modules — each one turns a
              dense textbook section into a five-minute mini-lesson with
              hands-on questions!
            </p>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={() => onStartModule(currentModuleIndex)}
                className="w-full max-w-sm py-4 bg-gray-900 text-white rounded-full font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                Begin Module {currentModuleIndex + 1}
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
              <button className="w-full max-w-sm py-4 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:border-gray-400 transition-all flex items-center justify-center gap-2">
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
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Column - Modules List */}
          <div className="space-y-4">
            {course.modules.map((module, index) => {
              const successfulLessons = module.lessons.filter((l) => l.success);
              const isCompleted = completedModules.includes(index);
              const isCurrent = currentModuleIndex === index;
              const isLocked = index > currentModuleIndex;

              return (
                <button
                  key={index}
                  onClick={() => !isLocked && onStartModule(index)}
                  disabled={isLocked}
                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all ${
                    isCurrent
                      ? "border-teal-400 bg-teal-50/50"
                      : isCompleted
                      ? "border-gray-200 bg-gray-50"
                      : isLocked
                      ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-lg font-semibold text-gray-400 flex-shrink-0">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {module.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {successfulLessons[0]?.data.title ||
                          `${successfulLessons.length} lessons`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Debug: Copy JSON Button */}
      <button
        onClick={handleCopyJSON}
        className="fixed bottom-6 right-6 p-4 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all z-50 group"
        title="Copy course JSON to clipboard"
      >
        {copied ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {copied ? "Copied!" : "Copy JSON"}
        </span>
      </button>

      <Footer />
    </div>
  );
}

export { ModulesScreen };
