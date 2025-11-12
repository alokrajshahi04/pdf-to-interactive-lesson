"use client";

import { useState, useEffect } from "react";
import lessonData from "@/lib/lesson.json";
import { LandingScreen } from "./components/landing-screen";
import { Dashboard } from "./components/dashboard";
import { ModulesScreen } from "./components/modules-screen";
import { ModuleCompleteScreen } from "./components/module-complete-screen";
import { LessonScreen } from "./components/lesson-screen";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import {
  useCourseNavigation,
  type Course,
} from "./hooks/use-course-navigation";
import {
  getStoredCourses,
  getCourse,
  saveCourse,
  updateCourseProgress,
  updateCourseData,
} from "@/lib/storage";

export default function Home() {
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const {
    // State
    course,
    showLanding,
    showModulesScreen,
    moduleIndex,
    lessonIndex,
    step,
    userAnswer,
    showResult,
    isGrading,
    gradingError,
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
    handleRetryGrading,
    setUserAnswer,
    canContinue,
    getButtonText,
  } = useCourseNavigation(lessonData as Course);

  // Check for saved courses on mount
  useEffect(() => {
    const savedCourses = getStoredCourses();
    if (savedCourses.length > 0 && !currentCourseId) {
      setShowDashboard(true);
    }
  }, [currentCourseId]);

  // Save progress whenever it changes
  useEffect(() => {
    if (currentCourseId && !showLanding && !showDashboard) {
      const totalModules = course.modules.length;
      const totalLessons = course.modules.reduce(
        (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
        0
      );
      const completedLessons =
        course.modules
          .slice(0, moduleIndex)
          .reduce(
            (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
            0
          ) + (step === "answer" ? 1 : 0);

      updateCourseProgress(currentCourseId, {
        currentModuleIndex: moduleIndex,
        currentLessonIndex: lessonIndex,
        completedModules,
        totalModules,
        totalLessons,
        completedLessons,
      });

      // Also update course data to persist grading results
      updateCourseData(currentCourseId, course);
    }
  }, [
    currentCourseId,
    moduleIndex,
    lessonIndex,
    completedModules,
    step,
    course,
    showLanding,
    showDashboard,
  ]);

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(course, null, 2));
      setCopiedJSON(true);
      setTimeout(() => setCopiedJSON(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    const stored = getCourse(courseId);
    if (!stored) return;

    // Load the course
    setCurrentCourseId(courseId);
    handleCourseGenerated(stored.course);
    setShowDashboard(false);
  };

  const handleUploadNew = () => {
    setShowDashboard(false);
    setCurrentCourseId(null);
  };

  // Override course generated to save to localStorage
  const handleCourseGeneratedWithSave = (generatedCourse: Course) => {
    const courseId = saveCourse(generatedCourse);
    setCurrentCourseId(courseId);
    handleCourseGenerated(generatedCourse);
  };

  // Show dashboard if we have saved courses
  if (showDashboard) {
    return (
      <Dashboard
        onSelectCourse={handleSelectCourse}
        onUploadNew={handleUploadNew}
      />
    );
  }

  // Show landing screen
  if (showLanding) {
    return (
      <LandingScreen
        onStartCourse={handleStartCourse}
        onCourseGenerated={handleCourseGeneratedWithSave}
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
            isGrading={isGrading}
            gradingError={gradingError}
            onAnswerChange={setUserAnswer}
            canContinue={canContinue()}
            onContinue={handleContinue}
            onRetryGrading={handleRetryGrading}
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
