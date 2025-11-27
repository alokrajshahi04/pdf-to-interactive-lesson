import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/api-key-storage";
import { useCredits } from "./use-credits";
import { debugLog } from "@/lib/utils/debug";
import type { FlowConfig } from "@/lib/types";

type QuestionType = "short-answer" | "true-false" | "multiple-choice" | "drag-drop" | "flow-diagram";

interface GradingResult {
  isCorrect: boolean;
  gradedAt: string;
}

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number | number[];
  title: string;
  questionType: QuestionType;
  choices?: string[];
  slots?: string[];
  flowConfig?: FlowConfig;
  gradingResult?: GradingResult;
  explanation?: string;
}

interface Lesson {
  success: boolean;
  data: LessonData;
}

interface Module {
  title: string;
  lessons: Lesson[];
}

export interface Course {
  title: string;
  modules: Module[];
}

export type Step =
  | "module-intro"
  | "content"
  | "question"
  | "answer"
  | "module-complete";

export interface ModuleStats {
  correct: number;
  total: number;
  startTime: number;
}

interface UseCourseNavigationOptions {
  initialModuleIndex?: number;
  initialLessonIndex?: number;
  initialStep?: Step;
  initialCompletedModules?: number[];
  onNavigate?: (params: {
    moduleIndex: number;
    lessonIndex: number;
    step: Step;
  }) => void;
  onModuleComplete?: (completedIndex: number, allCompleted: number[]) => void;
}

export function useCourseNavigation(
  initialCourse: Course,
  options?: UseCourseNavigationOptions
) {
  const { updateCredits } = useCredits();
  
  // Core state
  const [course, setCourse] = useState<Course>(initialCourse);
  const [showLanding, setShowLanding] = useState(true);
  const [showModulesScreen, setShowModulesScreen] = useState(false);

  // Sync course when initialCourse changes (for async loading)
  // Only update if we're going from empty/default course to a real course
  useEffect(() => {
    if (
      initialCourse &&
      initialCourse.modules.length > 0 &&
      (course.modules.length === 0 || course.title !== initialCourse.title)
    ) {
      setCourse(initialCourse);
    }
  }, [initialCourse, course.modules.length, course.title]);

  // Module/Lesson tracking
  const [moduleIndex, setModuleIndex] = useState(
    options?.initialModuleIndex ?? 0
  );
  const [lessonIndex, setLessonIndex] = useState(
    options?.initialLessonIndex ?? 0
  );
  const [completedModules, setCompletedModules] = useState<number[]>(
    options?.initialCompletedModules ?? []
  );

  // Lesson interaction
  const [step, setStep] = useState<Step>(
    options?.initialStep ?? "module-intro"
  );
  const [userAnswer, setUserAnswer] = useState<
    string | boolean | number | number[] | null
  >(null);
  const [showResult, setShowResult] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [moduleStats, setModuleStats] = useState<ModuleStats>({
    correct: 0,
    total: 0,
    startTime: Date.now(),
  });

  // Derived state
  const currentModule = course.modules[moduleIndex];
  const successfulLessons =
    currentModule?.lessons.filter((l) => l.success) || [];
  const currentLesson = successfulLessons[lessonIndex];

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
      ) + lessonIndex;

  const moduleProgressData = course.modules.map((mod, idx) => {
    const progress =
      idx < moduleIndex
        ? 100
        : idx === moduleIndex
        ? (lessonIndex / successfulLessons.length) * 100
        : 0;
    return { progress };
  });

  // Handlers
  const handleStartCourse = () => {
    setShowLanding(false);
    setShowModulesScreen(true);
  };

  const handleCourseGenerated = (generatedCourse: Course) => {
    setCourse(generatedCourse);
    setModuleIndex(0);
    setLessonIndex(0);
    setCompletedModules([]);
    setShowLanding(false);
    setShowModulesScreen(true);
  };

  const handleStartModule = (index: number) => {
    setModuleIndex(index);
    setLessonIndex(0);
    setStep("module-intro");
    setShowModulesScreen(false);
  };

  const handleBackToModules = () => {
    setShowModulesScreen(true);
  };

  const handleContinue = async () => {
    if (step === "module-intro") {
      setModuleStats({ correct: 0, total: 0, startTime: Date.now() });
      const newStep = "content";
      setStep(newStep);
      options?.onNavigate?.({
        moduleIndex,
        lessonIndex,
        step: newStep,
      });
    } else if (step === "content") {
      const newStep = "question";
      setStep(newStep);
      options?.onNavigate?.({
        moduleIndex,
        lessonIndex,
        step: newStep,
      });
    } else if (step === "question" && !showResult) {
      // Check answer and update stats
      const data = currentLesson?.data;
      if (!data) {
        debugLog.warn("[NAVIGATION] No lesson data found, returning early");
        return;
      }

      if (data.questionType === "short-answer") {
        // If we already have a grading result, clear it and re-grade
        // This ensures we always get fresh results when the user submits
        if (data.gradingResult) {
          // Clear the old grading result
          const updatedCourse = { ...course };
          const allLessons = updatedCourse.modules[moduleIndex].lessons;
          const successfulLessonIndex = successfulLessons.findIndex(
            (l) => l === currentLesson
          );
          if (successfulLessonIndex !== -1) {
            let actualIndex = 0;
            let successfulCount = 0;
            for (let i = 0; i < allLessons.length; i++) {
              if (allLessons[i].success) {
                if (successfulCount === successfulLessonIndex) {
                  actualIndex = i;
                  break;
                }
                successfulCount++;
              }
            }
            const lessonToUpdate = allLessons[actualIndex];
            if (lessonToUpdate && lessonToUpdate.success && lessonToUpdate.data.gradingResult) {
              delete lessonToUpdate.data.gradingResult;
              setCourse(updatedCourse);
              // Update the local data reference
              data.gradingResult = undefined;
            }
          }
        }
        
        // Call API to grade the answer (always, since we cleared cache if it existed)
        setIsGrading(true);
        setGradingError(null);

        try {
          const apiKey = getApiKey();
          if (!apiKey) {
            debugLog.error("[GRADING] Error: API key not found");
            throw new Error("API key not found. Please add it in settings.");
          }

          const requestBody = {
            userAnswer: userAnswer as string,
            correctAnswer: data.answer as string,
            content: data.content,
            info: data.info,
            question: data.question,
          };

          const response = await fetch("/api/grade-short-answer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Together-API-Key": apiKey,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json();
            debugLog.error("[GRADING] API error response", {
              status: response.status,
              errorData,
            });
            throw new Error(errorData.error || "Failed to grade answer");
          }

          const result = await response.json();
          const isCorrect = result.isCorrect;

          // Update lesson data with grading result

          const updatedCourse = { ...course };
          // Find the actual lesson index in the lessons array
          const allLessons = updatedCourse.modules[moduleIndex].lessons;
          const successfulLessonIndex = successfulLessons.findIndex(
            (l) => l === currentLesson
          );
          if (successfulLessonIndex !== -1) {
            // Find the corresponding lesson in the full lessons array
            let actualIndex = 0;
            let successfulCount = 0;
            for (let i = 0; i < allLessons.length; i++) {
              if (allLessons[i].success) {
                if (successfulCount === successfulLessonIndex) {
                  actualIndex = i;
                  break;
                }
                successfulCount++;
              }
            }
            const lessonToUpdate = allLessons[actualIndex];
            if (lessonToUpdate && lessonToUpdate.success) {
                lessonToUpdate.data.gradingResult = {
                  isCorrect,
                  gradedAt: new Date().toISOString(),
                };
                setCourse(updatedCourse);
              } else {
                debugLog.warn("[GRADING] Could not find lesson to update", {
                  actualIndex,
                  successfulLessonIndex,
                });
              }
            } else {
              debugLog.warn("[GRADING] Could not find successful lesson index");
            }

          // Update stats
          setModuleStats((prev) => ({
            ...prev,
            correct: prev.correct + (isCorrect ? 1 : 0),
            total: prev.total + 1,
          }));

          setShowResult(true);
          const newStep = "answer";
          setStep(newStep);
          options?.onNavigate?.({
            moduleIndex,
            lessonIndex,
            step: newStep,
          });
        } catch (error) {
          debugLog.error("[GRADING] Error grading answer:", error);
          setGradingError(
            error instanceof Error ? error.message : "Failed to grade answer"
          );
          // Don't proceed to answer step on error
        } finally {
          setIsGrading(false);
        }
      } else if (data.questionType === "drag-drop" || data.questionType === "flow-diagram") {
        // For drag-drop and flow-diagram, check arrays match exactly
        const userAnswerArray = userAnswer as number[];
        const correctAnswerArray = data.answer as number[];
        const isCorrect =
          Array.isArray(userAnswerArray) &&
          Array.isArray(correctAnswerArray) &&
          userAnswerArray.length === correctAnswerArray.length &&
          JSON.stringify(userAnswerArray) === JSON.stringify(correctAnswerArray);

        setModuleStats((prev) => ({
          ...prev,
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1,
        }));

        setShowResult(true);
        const newStep = "answer";
        setStep(newStep);
        options?.onNavigate?.({
          moduleIndex,
          lessonIndex,
          step: newStep,
        });
      } else {
        // For multiple-choice and true-false, check directly
        const isCorrect = userAnswer === data.answer;

        setModuleStats((prev) => ({
          ...prev,
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1,
        }));

        setShowResult(true);
        const newStep = "answer";
        setStep(newStep);
        options?.onNavigate?.({
          moduleIndex,
          lessonIndex,
          step: newStep,
        });
      }
    } else if (step === "answer") {
      // Move to next lesson or module
      if (lessonIndex < successfulLessons.length - 1) {
        const newLessonIndex = lessonIndex + 1;
        setLessonIndex(newLessonIndex);
        const newStep = "content";
        setStep(newStep);
        setUserAnswer(null);
        setShowResult(false);
        setGradingError(null);
        options?.onNavigate?.({
          moduleIndex,
          lessonIndex: newLessonIndex,
          step: newStep,
        });
      } else {
        // Module complete - mark as completed and advance currentModuleIndex
        const updatedCompleted = completedModules.includes(moduleIndex)
          ? completedModules
          : [...completedModules, moduleIndex];
        setCompletedModules(updatedCompleted);
        
        // Immediately notify parent to save progress
        options?.onModuleComplete?.(moduleIndex, updatedCompleted);
        
        const newStep = "module-complete";
        setStep(newStep);
        setUserAnswer(null);
        setShowResult(false);
        setGradingError(null);
        
        // Advance to next module index (so it unlocks on modules screen)
        const nextModuleIndex = moduleIndex + 1;
        setModuleIndex(nextModuleIndex);
        
        options?.onNavigate?.({
          moduleIndex,
          lessonIndex,
          step: newStep,
        });
      }
    } else if (step === "module-complete") {
      debugLog.log("[NAVIGATION] Moving from module-complete", {
        moduleIndex,
        totalModules: course.modules.length,
        hasNextModule: moduleIndex < course.modules.length - 1,
      });
      // Move to next module or back to modules screen
      if (moduleIndex < course.modules.length - 1) {
        const newModuleIndex = moduleIndex + 1;
        setModuleIndex(newModuleIndex);
        setLessonIndex(0);
        const newStep = "module-intro";
        setStep(newStep);
        options?.onNavigate?.({
          moduleIndex: newModuleIndex,
          lessonIndex: 0,
          step: newStep,
        });
      } else {
        // All modules complete - navigate back will be handled by the page component
        // For now, just stay on module-complete screen
        // The page component can detect this and navigate if needed
      }
    }
  };

  const handleRetryGrading = () => {
    setGradingError(null);
    // Retry by calling handleContinue again
    handleContinue();
  };

  const canContinue = () => {
    if (step === "question" && !showResult) {
      if (isGrading) return false;
      
      // For drag-drop and flow-diagram, check that all 3 slots are filled
      if (currentLesson?.data?.questionType === "drag-drop" || currentLesson?.data?.questionType === "flow-diagram") {
        if (Array.isArray(userAnswer)) {
          return userAnswer.length === 3 && userAnswer.every((val) => val !== -1 && val !== null && val !== undefined);
        }
        return false;
      }
      
      return userAnswer !== null;
    }
    return true;
  };

  const getButtonText = () => {
    if (step === "question" && !showResult) return "Check";
    if (step === "answer") return "Continue";
    return "Continue";
  };

  return {
    // State
    course,
    showLanding,
    showModulesScreen,
    moduleIndex,
    lessonIndex, // Export lessonIndex for progress tracking
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
    totalLessons,
    completedLessons,
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
  };
}
