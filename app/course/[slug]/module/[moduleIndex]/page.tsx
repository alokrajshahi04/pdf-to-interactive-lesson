"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ModuleCompleteScreen } from "@/app/components/module-complete-screen";
import { LessonScreen } from "@/app/components/lesson-screen";
import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { ApiKeyDialog } from "@/app/components/api-key-dialog";
import type { Course, Step } from "@/app/hooks/use-course-navigation";
import { useCourseNavigation } from "@/app/hooks/use-course-navigation";
import { getCourseProgress, updateCourseProgress } from "@/lib/course-progress";

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const moduleIndexParam = parseInt(params.moduleIndex as string, 10);
  const stepParam = (searchParams.get("step") || "module-intro") as Step;
  const lessonIndexParam = parseInt(searchParams.get("lesson") || "0", 10);

  const [course, setCourse] = useState<Course | null>(null);
  const [savedCompletedModules, setSavedCompletedModules] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const hasAnimatedPage = useRef(false);
  const shouldAnimatePage = !hasAnimatedPage.current;

  useEffect(() => {
    hasAnimatedPage.current = true;
  }, []);

  // Validate module index
  useEffect(() => {
    if (isNaN(moduleIndexParam)) {
      setError("Invalid module");
      setLoading(false);
    }
  }, [moduleIndexParam]);

  // Load course and progress from database
  useEffect(() => {
    const fetchCourseAndProgress = async () => {
      try {
        setLoading(true);
        
        // Fetch course data
        const courseResponse = await fetch(`/api/courses/${slug}`);
        if (!courseResponse.ok) {
          setError("Course not found");
          setLoading(false);
          return;
        }
        const courseData = await courseResponse.json();
        setCourse(courseData.course);

        // Load user's progress from localStorage
        const progress = getCourseProgress(slug);
        if (progress) {
          setSavedCompletedModules(progress.completedModules || []);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("Failed to load course");
        setLoading(false);
      }
    };

    fetchCourseAndProgress();
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
    router.push(url, { scroll: false });
  };

  // Default empty course structure to satisfy Rules of Hooks
  const defaultCourse: Course = {
    title: "",
    modules: [],
  };

  // Always call the hook (Rules of Hooks requirement)
  const navigation = useCourseNavigation(course || defaultCourse, {
    initialModuleIndex: isNaN(moduleIndexParam) ? 0 : moduleIndexParam,
    initialLessonIndex: isNaN(lessonIndexParam) ? 0 : lessonIndexParam,
    initialStep: stepParam,
    initialCompletedModules: savedCompletedModules,
    onNavigate: handleNavigate,
    onModuleComplete: (_completedIndex: number, allCompleted: number[]) => {
      // Immediately save when a module completes
      updateCourseProgress(slug, allCompleted);
    },
    onNeedsApiKey: () => {
      setIsApiKeyDialogOpen(true);
    },
  });

  // Update page title dynamically when course and module are loaded
  useEffect(() => {
    if (course && navigation.currentModule) {
      document.title = `${navigation.currentModule.title} - ${course.title} | PDF to Interactive Lesson Generator`;
    }
  }, [course, navigation.currentModule]);

  // Smooth scroll to top when reaching module-complete
  useEffect(() => {
    if (navigation.step === "module-complete") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [navigation.step]);

  // Preload celebration image
  useEffect(() => {
    const img = new Image();
    img.src = "/great-work.svg";
  }, []);


  // Handle navigation
  const handleBackToModules = () => {
    router.push(`/course/${slug}`);
  };

  const handleApiKeyDialogClose = (open: boolean) => {
    setIsApiKeyDialogOpen(open);
  };

  if (loading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header showNavLinks={true} courseTitle={course?.title} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Course not found</h1>
            <p className="text-neutral-600 mb-6">{error || "The course you're looking for doesn't exist."}</p>
            <button
              onClick={() => router.push("/courses")}
              className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
            >
              Back to Courses
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const {
    currentModule,
    successfulLessons,
    currentLesson,
    moduleProgressData,
    step,
    lessonIndex,
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

  // Hook hasn't synced with the real course yet — keep showing loading
  if (!currentModule && course.modules.length > 0 && moduleIndexParam < course.modules.length) {
    return <div className="min-h-screen bg-white" />;
  }

  // Only check for currentLesson if we're not on module-complete or module-intro steps
  if (!currentLesson && step !== "module-complete" && step !== "module-intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header
          showNavLinks={true}
          courseTitle={course?.title}
          course={course}
          currentModuleIndex={isNaN(moduleIndexParam) ? 0 : moduleIndexParam}
          onModuleSelect={(moduleIndex) => {
            router.push(`/course/${slug}/module/${moduleIndex}`);
          }}
        />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Lesson not found</h1>
            <button
              onClick={handleBackToModules}
              className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
            >
              Back to Modules
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const { data } = currentLesson || { data: null };

  // If module doesn't exist, show error
  if (!currentModule) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header showNavLinks={true} courseTitle={course?.title} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Module not found</h1>
            <p className="text-neutral-600 mb-6">The module you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push(`/course/${slug}`)}
              className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
            >
              Back to Modules
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ApiKeyDialog
        open={isApiKeyDialogOpen}
        onOpenChange={handleApiKeyDialogClose}
        message="An API key is needed to grade short-answer questions."
      />

      <Header
        showProgressBar={true}
        moduleProgress={moduleProgressData}
        showNavLinks={true}
        courseTitle={course?.title}
        course={course}
        currentModuleIndex={isNaN(moduleIndexParam) ? 0 : moduleIndexParam}
        onModuleSelect={(moduleIndex) => {
          router.push(`/course/${slug}/module/${moduleIndex}`);
        }}
      />

      {/* Main Content */}
      <div className="max-w-xl mx-auto px-6 py-16 flex-grow">
        {step === "module-complete" ? (
          <div className={shouldAnimatePage ? "animate-fadeIn" : undefined}>
            <ModuleCompleteScreen
              moduleIndex={isNaN(moduleIndexParam) ? 0 : moduleIndexParam}
              moduleTitle={currentModule.title}
              moduleStats={moduleStats}
              successfulLessons={successfulLessons}
              hasNextModule={!isNaN(moduleIndexParam) && moduleIndexParam < course.modules.length - 1}
              onContinue={handleContinue}
              onBackToModules={handleBackToModules}
            />
          </div>
        ) : (
          <div className={shouldAnimatePage ? "animate-fadeIn" : undefined}>
            <LessonScreen
              step={step}
              moduleIndex={isNaN(moduleIndexParam) ? 0 : moduleIndexParam}
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
          </div>
        )}
      </div>

      <Footer />

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}

