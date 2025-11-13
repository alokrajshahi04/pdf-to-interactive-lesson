"use client";

import { useState, useEffect, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { getApiKey } from "@/lib/api-key-storage";
import {
  getStoredCourses,
  deleteCourse,
  getCompletionPercentage,
  saveCourse,
  type StoredCourse,
} from "@/lib/storage";
import type { Course } from "@/app/hooks/use-course-navigation";
import { useCredits } from "../hooks/use-credits";
import { ApiKeyDialog } from "./api-key-dialog";
import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";

interface DashboardProps {
  onSelectCourse: (courseId: string) => void;
  onCourseGenerated?: (course: Course) => void;
}

function Dashboard({ onSelectCourse, onCourseGenerated }: DashboardProps) {
  const { updateCredits } = useCredits();
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCourses(getStoredCourses());
  }, []);

  const handleDelete = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this course?")) {
      deleteCourse(courseId);
      setCourses(getStoredCourses());
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
    if (file && file.type === "application/pdf") {
      await handleFileUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      await handleFileUpload(file);
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

    setIsProcessing(true);
    setError(null);
    setProgress("Uploading PDF...");

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setError("API key not configured. Please add your Together AI API key in settings.");
        setIsProcessing(false);
        return;
      }

      // Upload to Vercel Blob
      setProgress("Uploading PDF to storage...");
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-url",
      });

      // Generate course from PDF
      setProgress("Generating course from PDF...");
      const formData = new FormData();
      formData.append("url", blob.url);
      
      const response = await fetch("/api/generate-course", {
        method: "POST",
        headers: {
          "X-Together-API-Key": apiKey,
        },
        body: formData,
      });

      // Check credits from response header
      const creditsRemaining = response.headers.get("X-Credits-Remaining");
      if (creditsRemaining) {
        updateCredits(parseInt(creditsRemaining, 10));
      }

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          throw new Error(
            errorData.message ||
              `Insufficient credits. You have ${creditsRemaining || 0} credit(s) remaining.`
          );
        }
        throw new Error(errorData.error || "Failed to generate course");
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let courseData: Course | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "error") {
              throw new Error(event.error);
            } else if (event.type === "complete") {
              if (event.data?.creditsRemaining !== undefined) {
                updateCredits(event.data.creditsRemaining);
              }
              courseData = event.data.course;
              break;
            } else if (event.message) {
              setProgress(event.message);
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
        if (courseData) break;
      }

      if (!courseData) {
        throw new Error("Failed to generate course");
      }

      setProgress("Course generated successfully!");
      
      // Save course and refresh list
      const courseId = saveCourse(courseData);
      setCourses(getStoredCourses());

      // Call callback if provided
      if (onCourseGenerated) {
        onCourseGenerated(courseData);
      } else {
        // Navigate to the new course
        const stored = getStoredCourses().find((c) => c.id === courseId);
        if (stored?.slug) {
          window.location.href = `/course/${stored.slug}`;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process PDF. Please try again.";
      
      // Make error messages more helpful
      let displayError = errorMessage;
      if (errorMessage.includes("pages") && errorMessage.includes("100")) {
        displayError = "This PDF is too large. We currently support PDFs up to 100 pages. Please split your document into smaller sections or upload a shorter version.";
      } else if (errorMessage.includes("credits")) {
        displayError = errorMessage; // Keep credit errors as-is
      } else if (errorMessage.includes("API key")) {
        displayError = errorMessage; // Keep API key errors as-is
      }
      
      setError(displayError);
    } finally {
      setIsProcessing(false);
      setProgress("");
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
                src="/logo.svg" 
                alt="Logo"
                className="h-6 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {courses.length > 0 && (
              <Link
                href="/courses"
                className="flex items-center justify-center h-10 px-4 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors text-xs font-medium"
                aria-label="Courses"
              >
                Courses
              </Link>
            )}
            <button 
              onClick={() => setIsApiKeyDialogOpen(true)}
              className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
              aria-label="API Key"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
          </div>
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
          className={`lg:flex-1 border-[0.5px] border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors backdrop-blur-sm relative overflow-hidden ${
            isDragging
              ? "border-blue-500 bg-blue-50/80"
              : isProcessing
              ? "border-blue-500 bg-blue-50/80"
              : "border-neutral-400 bg-white/80"
          } ${!isProcessing ? "cursor-pointer" : ""}`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader size={32} className="mb-4 text-blue-500 [animation-duration:0.6s]" />
              <p className="text-neutral-700 font-medium">{progress}</p>
              <p className="text-sm text-neutral-500 mt-2">
                This may take a few minutes...
              </p>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
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
            {courses.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-neutral-500 text-sm">
                  No courses yet. Upload a PDF to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
              {courses.map((stored) => {
                const completion = getCompletionPercentage(stored);
                const isComplete = completion === 100;
                const { currentModuleIndex, totalModules } = stored.progress;

                return (
                  <div
                    key={stored.id}
                    onClick={() => onSelectCourse(stored.id)}
                    className="relative p-6 rounded-2xl border-[0.5px] text-left transition-all cursor-pointer"
                    style={
                      isComplete
                        ? {
                            backgroundColor: "#D8FFDC",
                            borderColor: "#00780E",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: "#d1d5db",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isComplete) {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      } else {
                        e.currentTarget.style.backgroundColor = "#c8f5d0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isComplete) {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      } else {
                        e.currentTarget.style.backgroundColor = "#D8FFDC";
                      }
                    }}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(stored.id, e)}
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
                      {stored.course.title}
                    </h3>

                    {/* Progress */}
                    <p className="text-sm text-neutral-600 mb-1">
                      {isComplete ? (
                        <span className="text-green-600 font-medium">
                          100% Complete
                        </span>
                      ) : (
                        <>
                          <span className="font-medium">
                            {completion}% Complete
                          </span>
                          {" - "}
                          <span className="text-neutral-500">
                            [Module {currentModuleIndex + 1}/{totalModules}]
                          </span>
                        </>
                      )}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-neutral-400 mt-3">
                      Last accessed:{" "}
                      {new Date(stored.lastAccessedAt).toLocaleDateString()}
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
          {courses.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-500 text-lg">
                No courses yet. Upload a PDF to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((stored) => {
                const completion = getCompletionPercentage(stored);
                const isComplete = completion === 100;
                const { currentModuleIndex, totalModules } = stored.progress;

                return (
                  <div
                    key={stored.id}
                    onClick={() => onSelectCourse(stored.id)}
                    className="relative p-6 rounded-2xl border-[0.5px] text-left transition-all cursor-pointer"
                    style={
                      isComplete
                        ? {
                            backgroundColor: "#D8FFDC",
                            borderColor: "#00780E",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: "#d1d5db",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isComplete) {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      } else {
                        e.currentTarget.style.backgroundColor = "#c8f5d0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isComplete) {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      } else {
                        e.currentTarget.style.backgroundColor = "#D8FFDC";
                      }
                    }}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(stored.id, e)}
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
                      {stored.course.title}
                    </h3>

                    {/* Progress */}
                    <p className="text-sm text-neutral-600 mb-1">
                      {isComplete ? (
                        <span className="text-green-600 font-medium">
                          100% Complete
                        </span>
                      ) : (
                        <>
                          <span className="font-medium">
                            {completion}% Complete
                          </span>
                          {" - "}
                          <span className="text-neutral-500">
                            [Module {currentModuleIndex + 1}/{totalModules}]
                          </span>
                        </>
                      )}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-neutral-400 mt-3">
                      Last accessed:{" "}
                      {new Date(stored.lastAccessedAt).toLocaleDateString()}
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
            src="/landing-footer-powered-by.svg" 
            alt="Powered by together.ai"
            className="h-auto"
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
            href="https://x.com" 
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
