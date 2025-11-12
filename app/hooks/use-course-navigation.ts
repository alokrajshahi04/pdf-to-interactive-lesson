import { useState } from "react";
import { getApiKey } from "@/lib/api-key-storage";
import { useCredits } from "./use-credits";

type QuestionType = "short-answer" | "true-false" | "multiple-choice";

interface GradingResult {
  isCorrect: boolean;
  gradedAt: string;
}

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number;
  title: string;
  questionType: QuestionType;
  choices?: string[];
  gradingResult?: GradingResult;
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

export function useCourseNavigation(initialCourse: Course) {
  const { updateCredits } = useCredits();
  
  // Core state
  const [course, setCourse] = useState<Course>(initialCourse);
  const [showLanding, setShowLanding] = useState(true);
  const [showModulesScreen, setShowModulesScreen] = useState(false);

  // Module/Lesson tracking
  const [moduleIndex, setModuleIndex] = useState(0);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [completedModules, setCompletedModules] = useState<number[]>([]);

  // Lesson interaction
  const [step, setStep] = useState<Step>("module-intro");
  const [userAnswer, setUserAnswer] = useState<
    string | boolean | number | null
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
      setStep("content");
    } else if (step === "content") {
      setStep("question");
    } else if (step === "question" && !showResult) {
      // Check answer and update stats
      const data = currentLesson?.data;
      if (!data) return;

      // For short-answer questions, call the grading API
      if (data.questionType === "short-answer") {
        // If we already have a grading result, use it
        if (data.gradingResult) {
          const isCorrect = data.gradingResult.isCorrect;
          setModuleStats((prev) => ({
            ...prev,
            correct: prev.correct + (isCorrect ? 1 : 0),
            total: prev.total + 1,
          }));
          setShowResult(true);
          setStep("answer");
        } else {
          // Call API to grade the answer
          setIsGrading(true);
          setGradingError(null);

          try {
            const apiKey = getApiKey();
            if (!apiKey) {
              throw new Error("API key not found. Please add it in settings.");
            }

            const response = await fetch("/api/grade-short-answer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Together-API-Key": apiKey,
              },
              body: JSON.stringify({
                userAnswer: userAnswer as string,
                correctAnswer: data.answer as string,
                content: data.content,
                info: data.info,
                question: data.question,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              const creditsRemaining = response.headers.get("X-Credits-Remaining");
              
              // Update credits from header if available
              if (creditsRemaining) {
                updateCredits(parseInt(creditsRemaining, 10));
              }
              
              // Handle credits error specifically
              if (response.status === 402) {
                throw new Error(
                  errorData.message || 
                  `Insufficient credits. You have ${creditsRemaining || 0} credit(s) remaining.`
                );
              }
              
              throw new Error(errorData.error || "Failed to grade answer");
            }

            const result = await response.json();
            const creditsRemaining = response.headers.get("X-Credits-Remaining");
            
            // Update credits from response header
            if (creditsRemaining) {
              updateCredits(parseInt(creditsRemaining, 10));
            }
            
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
              }
            }

            // Update stats
            setModuleStats((prev) => ({
              ...prev,
              correct: prev.correct + (isCorrect ? 1 : 0),
              total: prev.total + 1,
            }));

            setShowResult(true);
            setStep("answer");
          } catch (error) {
            console.error("Error grading answer:", error);
            setGradingError(
              error instanceof Error ? error.message : "Failed to grade answer"
            );
            // Don't proceed to answer step on error
          } finally {
            setIsGrading(false);
          }
        }
      } else {
        // For multiple-choice and true-false, check directly
        const isCorrect = userAnswer === data.answer;

        setModuleStats((prev) => ({
          ...prev,
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1,
        }));

        setShowResult(true);
        setStep("answer");
      }
    } else if (step === "answer") {
      // Move to next lesson or module
      if (lessonIndex < successfulLessons.length - 1) {
        setLessonIndex(lessonIndex + 1);
        setStep("content");
        setUserAnswer(null);
        setShowResult(false);
        setGradingError(null);
      } else {
        // Module complete - mark as completed
        if (!completedModules.includes(moduleIndex)) {
          setCompletedModules([...completedModules, moduleIndex]);
        }
        setStep("module-complete");
        setUserAnswer(null);
        setShowResult(false);
        setGradingError(null);
      }
    } else if (step === "module-complete") {
      // Move to next module or back to modules screen
      if (moduleIndex < course.modules.length - 1) {
        setModuleIndex(moduleIndex + 1);
        setLessonIndex(0);
        setStep("module-intro");
      } else {
        // All modules complete, go back to modules screen
        setShowModulesScreen(true);
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
      return userAnswer !== null && !isGrading;
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
