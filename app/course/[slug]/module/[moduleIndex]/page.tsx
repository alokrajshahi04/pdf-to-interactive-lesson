"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ModuleCompleteScreen } from "@/app/components/module-complete-screen";
import { LessonScreen } from "@/app/components/lesson-screen";
import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { getCourseBySlug, updateCourseProgress, updateCourseData } from "@/lib/storage";
import type { StoredCourse } from "@/lib/storage";
import type { Course, Step } from "@/app/hooks/use-course-navigation";
import { useCourseNavigation } from "@/app/hooks/use-course-navigation";
import { debugLog } from "@/lib/utils/debug";

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const moduleIndexParam = parseInt(params.moduleIndex as string, 10);
  const stepParam = (searchParams.get("step") || "module-intro") as Step;
  const lessonIndexParam = parseInt(searchParams.get("lesson") || "0", 10);

  const [storedCourse, setStoredCourse] = useState<StoredCourse | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load course from storage
  useEffect(() => {
    const stored = getCourseBySlug(slug);
    if (!stored) {
      setError("Course not found");
      setLoading(false);
      return;
    }

    setStoredCourse(stored);
    setCourse(stored.course);
    setLoading(false);
  }, [slug]);

  // Navigation callback to update URL
  const handleNavigate = ({
    moduleIndex,
    lessonIndex,
    step,
  }: {
    moduleIndex: number;
    lessonIndex: number;
    step: Step;
  }) => {
    const urlParams = new URLSearchParams();
    if (step !== "module-intro") {
      urlParams.set("step", step);
    }
    if (lessonIndex > 0) {
      urlParams.set("lesson", lessonIndex.toString());
    }
    const queryString = urlParams.toString();
    const url = `/course/${slug}/module/${moduleIndex}${queryString ? `?${queryString}` : ""}`;
    router.push(url);
  };

  // Default empty course structure to satisfy Rules of Hooks
  const defaultCourse: Course = {
    title: "",
    modules: [],
  };

  // Always call the hook (Rules of Hooks requirement)
  const navigation = useCourseNavigation(course || defaultCourse, {
    initialModuleIndex: moduleIndexParam,
    initialLessonIndex: lessonIndexParam,
    initialStep: stepParam,
    initialCompletedModules: storedCourse?.progress.completedModules,
    onNavigate: handleNavigate,
  });

  // Debug log for lesson data (must be before any conditional returns)
  useEffect(() => {
    if (course && navigation.currentLesson) {
      debugLog.log("[PAGE] Lesson page rendered", {
        slug,
        moduleIndex: moduleIndexParam,
        lessonIndex: lessonIndexParam,
        step: stepParam,
        hasCourse: !!course,
        hasCurrentLesson: !!navigation.currentLesson,
        questionType: navigation.currentLesson.data?.questionType,
        lessonTitle: navigation.currentLesson.data?.title,
        hasGradingResult: !!navigation.currentLesson.data?.gradingResult,
      });
    }
  }, [slug, moduleIndexParam, lessonIndexParam, stepParam, course, navigation.currentLesson]);

  // Save progress whenever it changes
  useEffect(() => {
    if (!storedCourse || !navigation || !course) return;

    const { moduleIndex, lessonIndex, completedModules, step } = navigation;
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

    updateCourseProgress(storedCourse.id, {
      currentModuleIndex: moduleIndex,
      currentLessonIndex: lessonIndex,
      completedModules,
      totalModules,
      totalLessons,
      completedLessons,
    });

    // Also update course data to persist grading results
    updateCourseData(storedCourse.id, course);
  }, [
    storedCourse?.id,
    navigation?.moduleIndex,
    navigation?.lessonIndex,
    navigation?.completedModules,
    navigation?.step,
    course,
  ]);

  // Handle navigation
  const handleBackToModules = () => {
    router.push(`/course/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Course not found</h1>
          <p className="text-gray-600 mb-6">{error || "The course you're looking for doesn't exist."}</p>
          <button
            onClick={() => router.push("/courses")}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  const {
    currentModule,
    successfulLessons,
    currentLesson,
    moduleProgressData,
    step,
    userAnswer,
    showResult,
    isGrading,
    gradingError,
    moduleStats,
    setUserAnswer,
    canContinue,
    getButtonText,
    handleRetryGrading,
    handleContinue,
  } = navigation;

  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Lesson not found</h1>
          <button
            onClick={handleBackToModules}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to Modules
          </button>
        </div>
      </div>
    );
  }

  const { data } = currentLesson;

  return (
    <div className="min-h-screen bg-white">
      <Header
        onBackClick={handleBackToModules}
        showProgressBar={true}
        moduleProgress={moduleProgressData}
        showNavLinks={true}
      />

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {step === "module-complete" ? (
          <ModuleCompleteScreen
            moduleIndex={moduleIndexParam}
            moduleTitle={currentModule.title}
            moduleStats={moduleStats}
            successfulLessons={successfulLessons}
            hasNextModule={moduleIndexParam < course.modules.length - 1}
            onContinue={handleContinue}
            onBackToModules={handleBackToModules}
          />
        ) : (
          <LessonScreen
            step={step}
            moduleIndex={moduleIndexParam}
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

