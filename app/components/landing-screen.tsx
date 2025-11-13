"use client";

import { useState, useEffect, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { getApiKey } from "@/lib/api-key-storage";
import { getStoredCourses } from "@/lib/storage";
import { ApiKeyDialog } from "./api-key-dialog";
import { useCredits } from "../hooks/use-credits";
import { Github, Twitter } from "lucide-react";
import Link from "next/link";

interface LandingScreenProps {
  onCourseGenerated: (courseData: any) => void;
}

function LandingScreen({
  onCourseGenerated,
}: LandingScreenProps) {
  const { updateCredits } = useCredits();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasCourses, setHasCourses] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkCourses = () => {
      const courses = getStoredCourses();
      setHasCourses(courses.length > 0);
    };
    
    // Check on mount
    checkCourses();
    
    // Listen for storage changes (from other tabs)
    window.addEventListener("storage", checkCourses);
    
    return () => {
      window.removeEventListener("storage", checkCourses);
    };
  }, []);

  // Update hasCourses when a course is generated
  const handleCourseGeneratedWrapper = (courseData: any) => {
    setHasCourses(true);
    onCourseGenerated(courseData);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const processFileUpload = async (file: File, apiKey: string) => {
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
    setProgress("Uploading PDF to storage...");

    try {
      // Upload file directly to Vercel Blob (client-side)
      // This bypasses the 4.5MB function payload limit
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-url",
      });

      setProgress("PDF uploaded! Generating course...");

      // Pass the blob URL to generate-course API with API key in headers
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
        throw new Error("Failed to generate course");
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete JSON objects (separated by newlines)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          let event;
          try {
            event = JSON.parse(line);
          } catch (parseError) {
            console.error("Failed to parse JSON:", line, parseError);
            continue;
          }

          // Handle the parsed event
          if (event.type === "error") {
            throw new Error(event.error);
          } else if (event.type === "complete") {
            // Update credits from completion data if available
            if (event.data?.creditsRemaining !== undefined) {
              updateCredits(event.data.creditsRemaining);
            }
            
            setProgress("Course generated successfully!");
            // Pass the generated course data to parent
            handleCourseGeneratedWrapper(event.data.course);
            setIsProcessing(false);
            return;
          } else {
            // Update progress with the message
            // For OCR progress, show more detailed info if available
            if (event.type === "ocr-progress" && event.data) {
              const { completed, total } = event.data;
              setProgress(`Extracting text from PDF (${completed}/${total} pages)`);
            } else if (event.type === "ocr-start" && event.data) {
              const { totalPages } = event.data;
              setProgress(`Extracting text from ${totalPages} pages...`);
            } else if (event.type === "modules-start") {
              setProgress("Generating course structure...");
            } else if (event.type === "modules-complete" && event.data) {
              const { moduleCount } = event.data;
              setProgress(`Generated ${moduleCount} modules`);
            } else if (event.type === "lessons-start" && event.data) {
              const { totalModules } = event.data;
              setProgress(`Generating lessons for ${totalModules} modules...`);
            } else if (event.type === "lessons-progress" && event.data) {
              const { completed, total, moduleTitle } = event.data;
              if (moduleTitle) {
                setProgress(`Generating lessons (${completed}/${total} modules): "${moduleTitle}"`);
              } else {
                setProgress(`Generating lessons (${completed}/${total} modules)`);
              }
            } else if (event.type === "course-complete") {
              setProgress(event.message);
            } else {
              setProgress(event.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error generating course:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate course"
      );
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    // Check for API key
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Please add your Together AI API key first.");
      setPendingFile(file); // Store the file to upload after API key is saved
      setIsApiKeyDialogOpen(true);
      return;
    }

    // Process the file upload
    await processFileUpload(file, apiKey);
  };

  const handleApiKeySaved = () => {
    // If there's a pending file and an API key now exists, automatically start the upload
    if (pendingFile) {
      const apiKey = getApiKey();
      if (apiKey) {
        const fileToUpload = pendingFile;
        setPendingFile(null); // Clear pending file before starting upload
        setError(null); // Clear any error messages
        // Small delay to ensure dialog closes smoothly
        setTimeout(() => {
          processFileUpload(fileToUpload, apiKey);
        }, 100);
      } else {
        // Dialog was dismissed without saving - clear pending state
        setPendingFile(null);
        setError(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white relative">
      {/* Background SVG */}
      <img 
        src="/landing-bg.svg" 
        alt="" 
        className="fixed -bottom-40 left-0 w-full h-auto z-0 opacity-[0.08] blur-2xl"
      />
      
      {/* API Key Dialog */}
      <ApiKeyDialog 
        open={isApiKeyDialogOpen} 
        onOpenChange={(open) => {
          setIsApiKeyDialogOpen(open);
          if (!open) {
            // When dialog closes, check if API key was saved and trigger upload
            handleApiKeySaved();
          }
        }}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-[0.5px] border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.svg" 
              alt="Logo"
              className="h-6 w-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            {hasCourses && (
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
              className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
              aria-label="API Key"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        {/* Badge */}
        <div className="flex justify-center mb-12">
          <a 
            href="https://together.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block"
          >
            <img 
              src="/landing-hero-powered-by.svg" 
              alt="Made & powered by together.ai"
              className="h-auto"
            />
          </a>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          {/* Decorative elements */}
          <img 
            src="/landing-left.svg" 
            alt="" 
            className="hidden md:block absolute left-0 top-0 w-80 h-80 opacity-100 z-0"
          />

          <img 
            src="/landing-right.svg" 
            alt="" 
            className="hidden md:block absolute right-0 top-0 w-80 h-80 opacity-100 z-0"
          />

          <h1 className="relative text-6xl font-bold text-neutral-900 mb-6 leading-none font-[family-name:var(--font-fustat)] z-10">
            Make a tailored
            <br />
            course for you
          </h1>
          <p className="relative text-xl text-neutral-700 mb-12 font-medium leading-tight font-[family-name:var(--font-fustat)] z-10">
            Upload any materials to generate
            <br />a personalized course!
          </p>

          {/* Upload Area */}
          <div className="max-w-2xl mx-auto">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-16 transition-all backdrop-blur-sm ${
                isDragging
                  ? "border-blue-500 bg-blue-50/80"
                  : isProcessing
                  ? "border-blue-500 bg-blue-50/80"
                  : error
                  ? "border-red-500 bg-red-50/80"
                  : "border-neutral-300 bg-white/80"
              } ${!isProcessing ? "cursor-pointer" : ""}`}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <div className="mb-4 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
                    id="file-upload"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mb-4 px-6 py-3 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isProcessing}
                    >
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
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Upload a PDF
                    </button>
                    <p className="text-sm text-neutral-500">
                      Or drag-and-drop here
                    </p>
                  </label>

                  {error && (
                    <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-4 left-4 z-10">
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
      </footer>

      {/* Social Icons */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3 z-10">
        <a 
          href="https://github.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
          aria-label="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
        <a 
          href="https://x.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
          aria-label="X (Twitter)"
        >
          <Twitter className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}

export { LandingScreen };
