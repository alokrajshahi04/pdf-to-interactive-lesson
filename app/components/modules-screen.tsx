"use client";

import { Header } from "./header";
import { Footer } from "./footer";

interface LessonData {
  content: string;
  info: string;
  question: string;
  answer: string | boolean | number | number[];
  title: string;
  questionType: string;
  choices?: string[];
  slots?: string[];
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
  const totalModules = course.modules.length;
  const totalLessons = course.modules.reduce(
    (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
    0
  );

  return (
    <div className="min-h-screen bg-white">
      <Header showNavLinks={true} courseTitle={course.title} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Course Overview */}
          <div className="flex flex-col justify-center items-center text-center lg:border-r lg:border-[#E5E5E5] lg:pr-16">
            <h2 className="text-5xl font-bold text-neutral-900 mb-6 leading-tight">
              We built your course!
            </h2>
            <p className="text-lg text-neutral-600 mb-12 leading-relaxed">
              Explore the {totalModules} bite-sized modules — each one turns a
              dense textbook section into a five-minute mini-lesson with
              hands-on questions!
            </p>

            {/* Action Buttons */}
            <div className="space-y-4 pb-16 w-full flex flex-col items-center">
              <button
                onClick={() => onStartModule(currentModuleIndex)}
                className="w-full max-w-sm py-4 gradient-border-button bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            </div>
          </div>

          {/* Right Column - Modules List */}
          <div className="space-y-4">
            <div className="border-t border-[#E5E5E5] py-8"></div>
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
                  className={`w-full text-left p-6 rounded-2xl border border-thin transition-all ${
                    isCurrent
                      ? "gradient-border bg-white"
                      : isCompleted
                      ? "border-[#D5D5D5] bg-[#F5F5F5]"
                      : isLocked
                      ? "border-[#D5D5D5] bg-[#F5F5F5] opacity-50 cursor-not-allowed"
                      : "border-[#D5D5D5] bg-[#F5F5F5] hover:border-[#D5D5D5]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-lg font-semibold text-neutral-400 flex-shrink-0">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-black mb-1">
                        {module.title}
                      </h3>
                      <p className="text-neutral-600 text-sm">
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

      <Footer />
    </div>
  );
}

export { ModulesScreen };
