"use client";

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "@/lib/api-key-storage";
import { getOrCreateUserId } from "@/lib/utils/session";
import { getCourseProgress } from "@/lib/course-progress";
import { storePendingFile } from "@/lib/utils/indexed-db-storage";
import type { Course } from "@/app/hooks/use-course-navigation";
import { HeaderActions } from "./header-actions";
import { ApiKeyDialog } from "./api-key-dialog";
import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { useImageFadeIn } from "../hooks/use-image-fade-in";


interface DatabaseCourse {
  id: string;
  slug: string;
  title: string;
  courseData: Course;
  createdAt: string;
  updatedAt: string;
}

function Dashboard() {
  const [courses, setCourses] = useState<DatabaseCourse[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFadeIn = useImageFadeIn("/logo.svg");
  const footerFadeIn = useImageFadeIn("/landing-footer-powered-by.svg");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoadingCourses(true);
        const response = await fetch("/api/courses");
        if (!response.ok) {
          throw new Error("Failed to load courses");
        }
        const data = await response.json();
        setCourses(data.courses || []);
      } catch (error) {
        console.error("Error fetching courses:", error);
        // Don't show error in UI, just leave courses empty
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchCourses();
  }, []);

  const handleDelete = async (courseSlug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this course? This action cannot be undone.")) {
      try {
        const response = await fetch(`/api/courses/${courseSlug}`, {
          method: "DELETE",
        });
        
        if (response.ok) {
          // Remove from local state
          setCourses(courses.filter(c => c.slug !== courseSlug));
        } else {
          alert("Failed to delete course. Please try again.");
        }
      } catch (error) {
        console.error("Error deleting course:", error);
        alert("Failed to delete course. Please try again.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        await handleFileUpload(file);
      } else if (file.type === "application/json" || file.name.endsWith(".json")) {
        await handleJsonUpload(file);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        await handleFileUpload(file);
      } else if (file.type === "application/json" || file.name.endsWith(".json")) {
        await handleJsonUpload(file);
      }
    }
  };

  const handleJsonUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setProgress("Reading JSON file...");

    try {
      // Read the JSON file
      const text = await file.text();
      const courseData = JSON.parse(text);

      // Basic validation
      if (!courseData.title || !courseData.modules || !Array.isArray(courseData.modules)) {
        throw new Error("Invalid course JSON format. Must have 'title' and 'modules' array.");
      }

      setProgress("Saving course to database...");

      // Save to database
      const userId = getOrCreateUserId();
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
        body: JSON.stringify({ course: courseData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save course");
      }

      const savedCourse = await response.json();
      setProgress("Course saved! Redirecting...");

      // Redirect to the course
      setTimeout(() => {
        window.location.href = `/course/${savedCourse.slug}`;
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process JSON file";
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Check file size as a rough proxy for page count (most PDFs are ~50-200KB per page)
    const estimatedPages = Math.ceil(file.size / (100 * 1024)); // Rough estimate
    if (estimatedPages > 100) {
      setError(
        `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
      );
      return;
    }

    // Check for API key
    const apiKey = getApiKey();
    
    // Check rate limit status (only if no API key)
    if (!apiKey) {
      try {
        const response = await fetch("/api/rate-limit-status");
        const rateLimitStatus = await response.json();
        
        if (rateLimitStatus.hasReachedCourseLimit) {
          setError("You've used all 3 free courses! Add your Together AI API key to generate unlimited courses.");
          setIsApiKeyDialogOpen(true);
          return;
        }
      } catch (error) {
        console.error("Failed to check rate limit:", error);
        // Continue with upload on error to be permissive
      }
    }

    try {
      await storePendingFile(file);
      window.location.href = "/generating";
    } catch (error) {
      console.error("Failed to store file:", error);
      setError("Failed to process file. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* API Key Dialog */}
      <ApiKeyDialog 
        open={isApiKeyDialogOpen} 
        onOpenChange={setIsApiKeyDialogOpen}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-[0.5px] border-neutral-200 bg-white w-full">
        <div className="w-full px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <img 
                ref={logoFadeIn.imgRef}
                src="/logo.svg" 
                alt="Logo"
                onLoad={logoFadeIn.handleLoad}
                onError={logoFadeIn.handleError}
                className={`h-6 w-auto transition-opacity duration-700 ease-out ${logoFadeIn.isLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </Link>
          </div>
          <HeaderActions />
        </div>
      </header>
      
      {/* Content Area */}
      <div className="flex flex-col lg:flex-row flex-1">
      {/* Left Sidebar */}
      <aside className="w-full lg:w-96 bg-white border-r-[0.5px] border-neutral-200 p-8 flex flex-col">
        <div className="mb-8 text-center lg:text-left">
          <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900 mb-2">
            Welcome back!
          </h1>
          <p className="text-sm lg:text-base text-neutral-600">
            Pick up right where you left off or start a fresh course from any
            PDF.
          </p>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`lg:h-64 border-[0.5px] border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors backdrop-blur-sm relative overflow-hidden ${
            isDragging
              ? "border-blue-500 bg-blue-50/80"
              : isProcessing
              ? "border-blue-500 bg-blue-50/80"
              : "border-neutral-400 bg-white/80"
          } ${!isProcessing ? "cursor-pointer" : ""}`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-neutral-700 font-medium">{progress}</p>
              <p className="text-sm text-neutral-500 mt-2">
                Redirecting to generation page...
              </p>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,application/json,.json"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload"
                disabled={isProcessing}
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors mb-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload a PDF
                </button>
              </label>
              <p className="text-sm text-neutral-500">
                Or drag-and-drop here
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                JSON upload available for debugging purposes
              </p>
            </>
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg w-full">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-red-800 font-medium text-sm mb-1">Error</p>
                  <p className="text-red-700 text-sm leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Course list section with separator and bg */}
        <div className="lg:hidden border-t-[0.5px] border-neutral-200 pt-12 mt-6 bg-neutral-100 -mx-8 -mb-8 px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            {isLoadingCourses ? (
              <div className="text-center py-10">
                <p className="text-neutral-500 text-sm">
                  Loading courses...
                </p>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-neutral-500 text-sm">
                  No courses yet. Upload a PDF to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
              {courses.map((course) => {
                const progress = getCourseProgress(course.slug);
                const modules = course.courseData?.modules || [];
                const totalModules = modules.filter((m: { lessons?: { success: boolean }[] }) => m.lessons?.some(l => l.success)).length;
                const completedModules = progress?.completedModules?.length || 0;
                const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
                
                return (
                  <div
                    key={course.id}
                    onClick={() => window.location.href = `/course/${course.slug}`}
                    className="relative p-6 rounded-2xl border-[0.5px] bg-white border-neutral-300 text-left transition-all cursor-pointer hover:bg-neutral-50"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(course.slug, e)}
                      className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                      title="Delete course"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    {/* Course Title */}
                    <h3 className="text-xl font-bold text-neutral-900 mb-2 pr-8">
                      {course.title}
                    </h3>

                    {/* Progress Bar - Always show */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-600">{completedModules} of {totalModules} modules</span>
                          <span className={`text-xs font-semibold ${progressPercent > 0 ? 'text-green-600' : 'text-neutral-400'}`}>{progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                    {/* Timestamp */}
                    <p className="text-xs text-neutral-400 mt-3">
                      Created: {new Date(course.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:p-12 bg-white lg:bg-white">
        {/* Desktop: Course list */}
        <div className="hidden lg:block max-w-7xl mx-auto">
          {isLoadingCourses ? (
            <div className="text-center py-20">
              <p className="text-neutral-500 text-lg">
                Loading courses...
              </p>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-500 text-lg">
                No courses yet. Upload a PDF to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((course) => {
                const progress = getCourseProgress(course.slug);
                const modules = course.courseData?.modules || [];
                const totalModules = modules.filter((m: { lessons?: { success: boolean }[] }) => m.lessons?.some(l => l.success)).length;
                const completedModules = progress?.completedModules?.length || 0;
                const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
                
                return (
                  <div
                    key={course.id}
                    onClick={() => window.location.href = `/course/${course.slug}`}
                    className="relative p-6 rounded-2xl border-[0.5px] bg-white border-neutral-300 text-left transition-all cursor-pointer hover:bg-neutral-50"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(course.slug, e)}
                      className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                      title="Delete course"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    {/* Course Title */}
                    <h3 className="text-xl font-bold text-neutral-900 mb-2 pr-8">
                      {course.title}
                    </h3>

                    {/* Progress Bar - Always show */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-600">{completedModules} of {totalModules} modules</span>
                          <span className={`text-xs font-semibold ${progressPercent > 0 ? 'text-green-600' : 'text-neutral-400'}`}>{progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                    {/* Timestamp */}
                    <p className="text-xs text-neutral-400 mt-3">
                      Created: {new Date(course.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t-[0.5px] border-neutral-200 px-4 py-4 flex items-center justify-between">
        <a 
          href="https://together.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block"
        >
          <img 
            ref={footerFadeIn.imgRef}
            src="/landing-footer-powered-by.svg" 
            alt="Powered by together.ai"
            onLoad={footerFadeIn.handleLoad}
            onError={footerFadeIn.handleError}
            className={`h-auto transition-opacity duration-700 ease-out ${footerFadeIn.isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </a>
        <div className="flex items-center gap-3">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
            aria-label="GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
          <a 
            href="https://x.com/nutlope" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
            aria-label="X (Twitter)"
          >
            <Twitter className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}

export { Dashboard };
