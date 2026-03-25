"use client";

import { useState, useEffect } from "react";
import { Check, Minus, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ApiKeyDialog } from "./api-key-dialog";
import type { Course } from "../hooks/use-course-navigation";
import { useImageFadeIn } from "../hooks/use-image-fade-in";

interface HeaderProps {
  showProgressBar?: boolean;
  moduleProgress?: Array<{ progress: number }>;
  showNavLinks?: boolean; // Show home/courses links
  showCoursesLink?: boolean; // Show courses link (for home page when courses exist)
  courseTitle?: string; // Course title to display in header
  course?: Course; // Course data for tooltips
  onModuleSelect?: (moduleIndex: number) => void; // Callback when a module is selected
  currentModuleIndex?: number; // Current module index to highlight
  completedModules?: number[]; // Array of completed module indices for lock logic
}

function Header({ showProgressBar, moduleProgress, showCoursesLink, courseTitle, course, onModuleSelect, currentModuleIndex, completedModules }: HeaderProps) {
  const logoFadeIn = useImageFadeIn("/logo.svg");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [credits, setCredits] = useState<{ coursesRemaining: number; gradingsRemaining: number } | null>(null);

  useEffect(() => {
    const fetchCredits = () => {
      fetch("/api/rate-limit-status")
        .then((res) => res.json())
        .then((data) => {
          if (data.courseLimit != null) {
            setCredits({
              coursesRemaining: data.courseLimit - data.coursesCreated,
              gradingsRemaining: data.gradingLimit - data.gradingsUsed,
            });
          }
        })
        .catch(() => {});
    };

    fetchCredits();
    window.addEventListener("credits-updated", fetchCredits);
    return () => window.removeEventListener("credits-updated", fetchCredits);
  }, []);

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-neutral-200">
      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog} />
      
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/">
            {/* eslint-disable react-hooks/refs */}
            <img 
              ref={logoFadeIn.imgRef}
              src="/logo.svg"
              alt="Logo"
              onLoad={logoFadeIn.handleLoad}
              onError={logoFadeIn.handleError}
              className={`h-6 w-auto transition-opacity duration-700 ease-out ${logoFadeIn.isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* eslint-enable react-hooks/refs */}
          </Link>
        </div>
        {courseTitle ? (
          <div className="flex items-center gap-1 min-w-0 flex-1 max-w-full">
            <h1 className="text-sm font-medium text-neutral-600 truncate pl-2 md:pl-8 pr-2 min-w-0">
              {courseTitle}
            </h1>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-neutral-600 hover:text-neutral-900 transition-colors flex-shrink-0">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2">
                  <div className="text-xs text-neutral-500 mb-2 px-2">Select Module</div>
                  {course?.modules.map((module, idx) => {
                    const isCurrent = currentModuleIndex === idx;
                    const modProgress = moduleProgress?.[idx];
                    const isCompleted = modProgress?.progress === 100;
                    // Module is locked if: it's not the first module AND the previous module is NOT completed
                    const isLocked = idx > 0 && !(completedModules || []).includes(idx - 1);
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (!isLocked) {
                            onModuleSelect?.(idx);
                          }
                        }}
                        disabled={isLocked}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isCurrent
                            ? "bg-neutral-100 text-neutral-900 font-medium"
                            : isLocked
                            ? "text-neutral-400 cursor-not-allowed opacity-50"
                            : "text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate min-w-0 flex-1">
                            Module {idx + 1}: {module.title}
                          </span>
                          <span className="flex-shrink-0 w-4 flex items-center justify-center">
                            {isLocked ? (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            ) : isCompleted ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
        
        {/* Right Side Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showCoursesLink && (
            <Link
              href="/courses"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors px-3 py-1.5"
            >
              Courses
            </Link>
          )}
          {credits && (
            <span className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-3 py-1.5 tabular-nums">
              {credits.coursesRemaining} courses · {credits.gradingsRemaining} gradings
            </span>
          )}
          <button
            onClick={() => setShowApiKeyDialog(true)}
            className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
            aria-label="API Key"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {showProgressBar && moduleProgress && (
        <TooltipProvider>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex gap-2">
              {moduleProgress.map((mod, idx) => {
                const courseModule = course?.modules[idx];
                const successfulLessons = courseModule?.lessons.filter((l) => l.success) || [];
                const totalLessons = successfulLessons.length;
                // Calculate completed lessons based on progress
                const completedLessons = mod.progress === 100 
                  ? totalLessons 
                  : Math.max(0, Math.floor((mod.progress / 100) * totalLessons));
                const completedQuestions = completedLessons; // Assuming 1 question per lesson
                const totalQuestions = totalLessons;
                
                // Extract topics from lesson titles (first few words)
                const topics = successfulLessons.slice(0, 3).map(lesson => 
                  lesson.data?.title?.split(':')[0]?.trim() || lesson.data?.title?.split('.')[0]?.trim() || lesson.data?.title
                ).filter(Boolean).slice(0, 3);

                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div
                        className="flex-1 h-2 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] relative overflow-hidden cursor-pointer"
                      >
                        {mod.progress > 0 && (
                          <div
                            className="h-full bg-green-600 rounded-full transition-all duration-300"
                            style={{ width: `${mod.progress}%` }}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="p-0 w-72 bg-white border border-neutral-200 shadow-lg rounded-lg">
                      <div className="p-4">
                        <div className="text-xs text-neutral-500 mb-0.5">Module {idx + 1}</div>
                        <h3 className="text-base font-bold text-neutral-900 mb-2">{courseModule?.title || `Module ${idx + 1}`}</h3>
                        {topics.length > 0 && (
                          <div className="text-sm text-neutral-600 mb-3">
                            {topics.join(", ")}
                          </div>
                        )}
                        <div className="border-t border-[#E5E5E5] pt-3 pb-2 -mx-4 px-4" style={{ borderWidth: '0.5px' }}>
                          <div className="text-xs text-neutral-600 mb-2">Progress:</div>
                          <div className="flex items-center gap-1.5 text-xs mb-1.5">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-neutral-600">Questions:</span>
                            <span className="text-green-600 font-semibold">{completedQuestions}</span>
                            <span className="text-neutral-400">/ {totalQuestions}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Minus className="w-3.5 h-3.5 text-neutral-900" />
                            <span className="text-neutral-600">Lessons:</span>
                            <span className="text-neutral-900 font-semibold">{completedLessons}</span>
                            <span className="text-neutral-400">/ {totalLessons}</span>
                          </div>
                        </div>
                        <div className="pt-3 -mx-4 px-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">Time spent:</span>
                            <span className="text-neutral-900 font-semibold">
                              {Math.max(1, Math.floor((mod.progress / 100) * 15))} mins
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

export { Header };
