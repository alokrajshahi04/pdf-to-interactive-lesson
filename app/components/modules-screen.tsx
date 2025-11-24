"use client";

import { useState } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { ShareCourseDialog } from "./share-course-dialog";
import { Share2 } from "lucide-react";
import type { Course } from "@/app/hooks/use-course-navigation";

interface ModulesScreenProps {
  course: Course;
  courseSlug: string;
  onStartModule: (moduleIndex: number) => void;
  onJumpToLesson?: (moduleIndex: number, lessonIndex: number) => void;
  completedModules: number[];
  currentModuleIndex: number;
}

function ModulesScreen({
  course,
  courseSlug,
  onStartModule,
  onJumpToLesson,
  completedModules,
  currentModuleIndex,
}: ModulesScreenProps) {
  const [copied, setCopied] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const totalModules = course.modules.length;
  const totalLessons = course.modules.reduce(
    (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
    0
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(course, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate module progress for header
  const moduleProgressData = course.modules.map((_, idx) => ({
    progress: completedModules.includes(idx) ? 100 : (currentModuleIndex === idx ? 50 : 0),
  }));

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header 
        showNavLinks={true} 
        courseTitle={course.title}
        course={course}
        currentModuleIndex={currentModuleIndex}
        moduleProgress={moduleProgressData}
        completedModules={completedModules}
        onModuleSelect={(moduleIndex) => onStartModule(moduleIndex)}
      />

      {/* Share Dialog */}
      <ShareCourseDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        courseTitle={course.title}
        courseSlug={courseSlug}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Course Overview */}
          <div className="flex flex-col justify-center items-center text-center lg:pr-16">
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
              
              <button
                onClick={() => setIsShareDialogOpen(true)}
                className="w-full max-w-sm py-4 border-2 border-neutral-900 text-neutral-900 font-semibold rounded-2xl hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-5 h-5" />
                Share Course
              </button>
            </div>
          </div>

          {/* Right Column - Modules List */}
          <div className="space-y-4">
            {course.modules.map((module, index) => {
              const successfulLessons = module.lessons.filter((l) => l.success);
              const isCompleted = completedModules.includes(index);
              const isCurrent = currentModuleIndex === index;
              // Module is unlocked if: it's the first module, OR the previous module is completed
              const isLocked = index > 0 && !completedModules.includes(index - 1);

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

        {/* Debug Info (Local Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-16 space-y-6">
            {/* Quick Jump to Lessons */}
            {onJumpToLesson && (
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="text-sm font-semibold text-blue-900 mb-4">Debug: Jump to Lesson (Local Only)</h3>
                <div className="space-y-4">
                  {course.modules.map((module, moduleIndex) => {
                    const successfulLessons = module.lessons.filter((l) => l.success);
                    return (
                      <div key={moduleIndex} className="bg-white rounded-lg p-4 border border-blue-100">
                        <h4 className="text-sm font-semibold text-neutral-900 mb-3">
                          Module {moduleIndex + 1}: {module.title}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {successfulLessons.map((lesson, lessonIndex) => {
                            const questionType = lesson.data.questionType;
                            const getTypeColor = (type: string) => {
                              switch (type) {
                                case 'flow-diagram':
                                  return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200';
                                case 'drag-drop':
                                  return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200';
                                case 'multiple-choice':
                                  return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
                                case 'true-false':
                                  return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
                                case 'short-answer':
                                  return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200';
                                default:
                                  return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200';
                              }
                            };
                            
                            const getTypeLabel = (type: string) => {
                              switch (type) {
                                case 'flow-diagram':
                                  return '🌊 Flow';
                                case 'drag-drop':
                                  return '🔀 Drag-Drop';
                                case 'multiple-choice':
                                  return '✓ MC';
                                case 'true-false':
                                  return '✓✗ T/F';
                                case 'short-answer':
                                  return '✍️ Short';
                                default:
                                  return type;
                              }
                            };

                            return (
                              <button
                                key={lessonIndex}
                                onClick={() => onJumpToLesson(moduleIndex, lessonIndex)}
                                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${getTypeColor(questionType)}`}
                                title={`${lesson.data.title} - Click to jump to this lesson`}
                              >
                                <div className="flex flex-col items-start gap-1">
                                  <span className="font-semibold">{getTypeLabel(questionType)}</span>
                                  <span className="text-[10px] opacity-80 max-w-[120px] truncate">
                                    {lesson.data.title}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Course JSON */}
            <div className="p-6 bg-neutral-100 border border-neutral-300 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-900">Debug: Full Course JSON (Local Only)</h3>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy JSON
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs text-neutral-800 overflow-auto max-h-96 whitespace-pre-wrap break-words">
                {JSON.stringify(course, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export { ModulesScreen };
