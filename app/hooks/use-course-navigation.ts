import { useState } from "react";

type QuestionType = "short-answer" | "true-false" | "multiple-choice";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number;
  title: string;
  questionType: QuestionType;
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

  const handleContinue = () => {
    if (step === "module-intro") {
      setModuleStats({ correct: 0, total: 0, startTime: Date.now() });
      setStep("content");
    } else if (step === "content") {
      setStep("question");
    } else if (step === "question" && !showResult) {
      // Check answer and update stats
      const data = currentLesson?.data;
      if (!data) return;

      const isCorrect =
        data.questionType === "multiple-choice" ||
        data.questionType === "true-false"
          ? userAnswer === data.answer
          : true; // For short answer, count as correct

      setModuleStats((prev) => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      setShowResult(true);
      setStep("answer");
    } else if (step === "answer") {
      // Move to next lesson or module
      if (lessonIndex < successfulLessons.length - 1) {
        setLessonIndex(lessonIndex + 1);
        setStep("content");
        setUserAnswer(null);
        setShowResult(false);
      } else {
        // Module complete - mark as completed
        if (!completedModules.includes(moduleIndex)) {
          setCompletedModules([...completedModules, moduleIndex]);
        }
        setStep("module-complete");
        setUserAnswer(null);
        setShowResult(false);
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

  const canContinue = () => {
    if (step === "question" && !showResult) {
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
    lessonIndex,
    step,
    userAnswer,
    showResult,
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
    setUserAnswer,
    canContinue,
    getButtonText,
  };
}
