"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ModuleCompleteScreen } from "@/app/components/module-complete-screen";
import { LessonScreen } from "@/app/components/lesson-screen";
import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { ApiKeyDialog } from "@/app/components/api-key-dialog";
import { Button } from "@/app/components/ui/button";
import { LessonSkeleton } from "@/app/components/ui/skeleton";
import type { Course, Step } from "@/lib/types";
import { useCourseNavigation } from "@/app/hooks/use-course-navigation";
import { getCourseProgress, updateCourseProgress } from "@/lib/course-progress";

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const moduleIndexParam = parseInt(params.moduleIndex as string, 10);
  const isInvalidModuleIndex = isNaN(moduleIndexParam);
  const stepParam = (searchParams.get("step") || "module-intro") as Step;
  const lessonIndexParam = parseInt(searchParams.get("lesson") || "0", 10);

  const [course, setCourse] = useState<Course | null>(null);
  const [savedCompletedModules, setSavedCompletedModules] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [shouldAnimatePage, setShouldAnimatePage] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShouldAnimatePage(false);
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Lock guard: if the user reaches a module URL without having completed the
  // prerequisite, bounce them back to the modules list. The dropdown disables
  // locked modules client-side, but the URL is still typeable / refreshable.
  // Fires once loading completes (so savedCompletedModules is populated) and
  // re-runs on URL changes (dropdown nav) and on mid-session completions
  // (which update savedCompletedModules below).
  useEffect(() => {
    if (loading || !course) return;
    if (isInvalidModuleIndex || moduleIndexParam === 0) return;
    if (!savedCompletedModules.includes(moduleIndexParam - 1)) {
      router.replace(`/course/${slug}`);
    }
  }, [loading, course, isInvalidModuleIndex, moduleIndexParam, savedCompletedModules, slug, router]);

  // Load course and progress from database
  useEffect(() => {
    if (isInvalidModuleIndex) return;

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
  }, [isInvalidModuleIndex, slug]);

  // Navigation callback to update URL without triggering Next.js page navigation
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
    // Use pushState to update the URL without a full page refresh.
    // The UI is driven by useCourseNavigation's internal state, so we only
    // need the URL to stay in sync for bookmarking and page refresh.
    window.history.pushState(null, "", url);
  };

  // Default empty course structure to satisfy Rules of Hooks
  const defaultCourse: Course = {
    title: "",
    modules: [],
  };

  // Always call the hook (Rules of Hooks requirement)
  const navigation = useCourseNavigation(course || defaultCourse, {
    initialModuleIndex: isInvalidModuleIndex ? 0 : moduleIndexParam,
    initialLessonIndex: isNaN(lessonIndexParam) ? 0 : lessonIndexParam,
    initialStep: stepParam,
    initialCompletedModules: savedCompletedModules,
    onNavigate: handleNavigate,
    onModuleComplete: (_completedIndex: number, allCompleted: number[]) => {
      // Immediately save when a module completes
      updateCourseProgress(slug, allCompleted);
      // Keep page-level state in sync so the URL guard and Header lock logic
      // see fresh completions without waiting for the next page load.
      setSavedCompletedModules(allCompleted);
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

  // Track scroll position to prevent unwanted scroll jumps on answer submit
  const scrollPositionRef = useRef<number | null>(null);
  const shouldRestoreAnswerScrollRef = useRef(false);

  const handleContinueWithScroll = () => {
    // Save scroll position before submitting an answer
    if (navigation.step === "question" && !navigation.showResult) {
      scrollPositionRef.current = window.scrollY;
      shouldRestoreAnswerScrollRef.current = true;
    }
    navigation.handleContinue();
  };

  useLayoutEffect(() => {
    if (navigation.step === "answer") {
      if (!shouldRestoreAnswerScrollRef.current || scrollPositionRef.current === null) return;
      const savedPosition = scrollPositionRef.current;
      shouldRestoreAnswerScrollRef.current = false;
      window.scrollTo({ top: savedPosition, behavior: "auto" });
      const frameId = requestAnimationFrame(() => {
        window.scrollTo({ top: savedPosition, behavior: "auto" });
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [navigation.step]);

  // Manage scroll position on step transitions
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";

    if (
      navigation.step === "module-complete" ||
      navigation.step === "content" ||
      navigation.step === "module-intro"
    ) {
      window.scrollTo({ top: 0, behavior });
    }
  }, [navigation.step]);

  // Preload celebration image
  useEffect(() => {
    const img = new Image();
    img.src = "/great-work.webp";
  }, []);


  // Handle navigation
  const handleBackToModules = () => {
    router.push(`/course/${slug}`);
  };

  const handleApiKeyDialogClose = (open: boolean) => {
    setIsApiKeyDialogOpen(open);
  };

  const pageError = isInvalidModuleIndex ? "Invalid module" : error;

  if (!isInvalidModuleIndex && loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header showCoursesLink={true} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow w-full">
          <LessonSkeleton />
        </div>
      </div>
    );
  }

  if (pageError || !course) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header showCoursesLink={true} courseTitle={course?.title} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Course not found</h1>
            <p className="text-neutral-600 mb-6">{pageError || "The course you’re looking for doesn’t exist."}</p>
            <Button shape="lg" onClick={() => router.push("/courses")}>
              Back to courses
            </Button>
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
    moduleIndex: currentModuleIndex,
    userAnswer,
    showResult,
    isGrading,
    gradingError,
    gradingErrorCode,
    answerResult,
    moduleStats,
    setUserAnswer,
    canContinue,
    getButtonText,
    handleRetryGrading,
    handleContinue,
  } = navigation;

  // Hook hasn't synced with the real course yet — keep showing loading
  if (!currentModule && course.modules.length > 0 && moduleIndexParam < course.modules.length) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header showCoursesLink={true} courseTitle={course?.title} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow w-full">
          <LessonSkeleton />
        </div>
      </div>
    );
  }

  // Only check for currentLesson if we're not on module-complete or module-intro steps
  if (!currentLesson && step !== "module-complete" && step !== "module-intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header
          showCoursesLink={true}
          courseTitle={course?.title}
          course={course}
          currentModuleIndex={currentModuleIndex}
          completedModules={navigation.completedModules}
          onModuleSelect={(moduleIndex) => {
            router.push(`/course/${slug}/module/${moduleIndex}`);
          }}
        />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Lesson not found</h1>
            <Button shape="lg" onClick={handleBackToModules}>
              Back to modules
            </Button>
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
        <Header showCoursesLink={true} courseTitle={course?.title} />
        <div className="max-w-xl mx-auto px-6 py-16 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Module not found</h1>
            <p className="text-neutral-600 mb-6">The module you’re looking for doesn’t exist.</p>
            <Button shape="lg" onClick={() => router.push(`/course/${slug}`)}>
              Back to modules
            </Button>
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
        showCoursesLink={true}
        courseTitle={course?.title}
        course={course}
        currentModuleIndex={currentModuleIndex}
        completedModules={navigation.completedModules}
        onModuleSelect={(moduleIndex) => {
          router.push(`/course/${slug}/module/${moduleIndex}`);
        }}
      />

      {/* Main Content */}
      <div className="max-w-xl mx-auto px-6 py-16 flex-grow">
        {step === "module-complete" ? (
          <div className={shouldAnimatePage ? "animate-fadeIn" : undefined}>
            <ModuleCompleteScreen
              moduleIndex={currentModuleIndex}
              moduleTitle={currentModule.title}
              moduleStats={moduleStats}
              successfulLessons={successfulLessons}
              hasNextModule={currentModuleIndex < course.modules.length - 1}
              onContinue={handleContinue}
              onBackToModules={handleBackToModules}
            />
          </div>
        ) : (
          <div className={shouldAnimatePage ? "animate-fadeIn" : undefined}>
            <LessonScreen
              step={step}
              moduleIndex={currentModuleIndex}
              moduleTitle={currentModule.title}
              lessonData={data}
              successfulLessonsCount={successfulLessons.length}
              userAnswer={userAnswer}
              showResult={showResult}
              isGrading={isGrading}
              gradingError={gradingError}
              gradingErrorCode={gradingErrorCode}
              answerResult={answerResult}
              onAnswerChange={setUserAnswer}
              canContinue={canContinue()}
              onContinue={handleContinueWithScroll}
              onRetryGrading={handleRetryGrading}
              onUpdateApiKey={() => setIsApiKeyDialogOpen(true)}
              getButtonText={getButtonText}
            />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
