"use client";

import { useState } from "react";
import lessonData from "@/data/lesson.json";
import { LandingScreen } from "./components/landing-screen";
import { ModulesScreen } from "./components/modules-screen";
import { ModuleCompleteScreen } from "./components/module-complete-screen";
import { LessonScreen } from "./components/lesson-screen";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import {
  useCourseNavigation,
  type Course,
} from "./hooks/use-course-navigation";

export default function Home() {
  const [copiedJSON, setCopiedJSON] = useState(false);

  const {
    // State
    course,
    showLanding,
    showModulesScreen,
    moduleIndex,
    step,
    userAnswer,
    showResult,
    moduleStats,
    completedModules,

    // Derived state
    currentModule,
    successfulLessons,
    currentLesson,
    moduleProgressData,

    // Handlers
    handleStartCourse,
    handleCourseGenerated,
    handleStartModule,
    handleBackToModules,
    handleContinue,
    setUserAnswer,
    canContinue,
    getButtonText,
  } = useCourseNavigation(lessonData as Course);

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(course, null, 2));
      setCopiedJSON(true);
      setTimeout(() => setCopiedJSON(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Show landing screen
  if (showLanding) {
    return (
      <LandingScreen
        onStartCourse={handleStartCourse}
        onCourseGenerated={handleCourseGenerated}
      />
    );
  }

  // Show modules screen
  if (showModulesScreen) {
    return (
      <ModulesScreen
        course={course}
        onStartModule={handleStartModule}
        completedModules={completedModules}
        currentModuleIndex={moduleIndex}
      />
    );
  }

  if (!currentLesson) return null;

  const { data } = currentLesson;

  return (
    <div className="min-h-screen bg-white">
      <Header
        onBackClick={handleBackToModules}
        showProgressBar={true}
        moduleProgress={moduleProgressData}
      />

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {step === "module-complete" ? (
          <ModuleCompleteScreen
            moduleIndex={moduleIndex}
            moduleTitle={currentModule.title}
            moduleStats={moduleStats}
            successfulLessons={successfulLessons}
            hasNextModule={moduleIndex < course.modules.length - 1}
            onContinue={handleContinue}
            onBackToModules={handleBackToModules}
          />
        ) : (
          <LessonScreen
            step={step}
            moduleIndex={moduleIndex}
            moduleTitle={currentModule.title}
            lessonData={data}
            successfulLessonsCount={successfulLessons.length}
            userAnswer={userAnswer}
            showResult={showResult}
            onAnswerChange={setUserAnswer}
            canContinue={canContinue()}
            onContinue={handleContinue}
            getButtonText={getButtonText}
          />
        )}
      </div>

      {/* Debug: Copy JSON Button */}
      <button
        onClick={handleCopyJSON}
        className="fixed bottom-6 right-6 p-4 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all z-50 group"
        title="Copy course JSON to clipboard"
      >
        {copiedJSON ? (
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
          {copiedJSON ? "Copied!" : "Copy JSON"}
        </span>
      </button>

      <Footer />

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
