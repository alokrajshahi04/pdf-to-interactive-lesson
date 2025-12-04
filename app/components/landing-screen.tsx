"use client";

import { useState, useEffect, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { getApiKey } from "@/lib/api-key-storage";
import { storePendingFile } from "@/lib/utils/indexed-db-storage";
import { getOrCreateUserId } from "@/lib/utils/session";
import { ApiKeyDialog } from "./api-key-dialog";
import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import { Loader } from "@/components/ai-elements/loader";
import { LogoSvg, LandingHeroPoweredBySvg, LandingFooterPoweredBySvg, LandingBgSvg } from "./svg-icons";
import type { Course } from "@/app/hooks/use-course-navigation";
import demoCourse from "@/lib/demo/transformer-course.json";

interface LandingScreenProps {
  onCourseGenerated: (courseData: any) => void;
}

function LandingScreen({
  onCourseGenerated,
}: LandingScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasCourses, setHasCourses] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkCourses = async () => {
      try {
        const response = await fetch('/api/courses');
        if (response.ok) {
          const data = await response.json();
          setHasCourses(data.courses.length > 0);
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      }
    };
    
    // Check on mount
    checkCourses();
    
    // Listen for storage changes (from other tabs)
    window.addEventListener("storage", checkCourses);
    
    return () => {
      window.removeEventListener("storage", checkCourses);
    };
  }, []);

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
      const file = files[0];
      if (file.name.endsWith(".json")) {
        handleJsonUpload(file);
      } else {
        handleFileUpload(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".json")) {
        handleJsonUpload(file);
      } else {
        handleFileUpload(file);
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

  const processFileUpload = async (file: File, apiKey: string) => {
    // Check file size as a rough proxy for page count (most PDFs are ~50-200KB per page)
    const estimatedPages = Math.ceil(file.size / (100 * 1024)); // Rough estimate
    if (estimatedPages > 100) {
      setError(
        `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
      );
      return;
    }

    try {
      // Store file in IndexedDB (avoids sessionStorage quota limits)
      await storePendingFile(file);
      // Redirect immediately to generating page
      window.location.href = "/generating";
    } catch (error) {
      console.error("Failed to store file:", error);
      setError("Failed to process file. Please try again.");
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
    
    // Check rate limit status (only if no API key)
    if (!apiKey) {
      try {
        const response = await fetch("/api/rate-limit-status");
        const rateLimitStatus = await response.json();
        
        if (rateLimitStatus.hasReachedLimit) {
          setError("You've created your free course! Add your Together AI API key to generate unlimited courses.");
          setPendingFile(file); // Store the file to upload after API key is saved
          setIsApiKeyDialogOpen(true);
          return;
        }
      } catch (error) {
        console.error("Failed to check rate limit:", error);
        // Continue with upload on error to be permissive
      }
    }

    // Process the file upload
    await processFileUpload(file, apiKey || "");
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

  const handleTryDemo = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress("Loading demo course...");
      
      // Save the demo course to database via API
      const userId = getOrCreateUserId();
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
        body: JSON.stringify({ course: demoCourse }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save demo course");
      }

      const savedCourse = await response.json();
      
      if (savedCourse && savedCourse.slug) {
        // Navigate to the course using its slug
        window.location.href = `/course/${savedCourse.slug}`;
      } else {
        throw new Error("Failed to retrieve course details");
      }
    } catch (error) {
      console.error("Failed to load demo:", error);
      setError("Failed to load demo course. Please try again.");
      setIsProcessing(false);
    }
  };

  // Track loading state for large decorative images only
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const imageRefs = {
    left: useRef<HTMLImageElement>(null),
    right: useRef<HTMLImageElement>(null),
  };

  const handleImageLoad = (imageName: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageName));
  };

  const handleImageError = (imageName: string) => {
    // If image fails to load, still mark it as "loaded" so it doesn't stay invisible
    setLoadedImages((prev) => new Set(prev).add(imageName));
  };

  // Check if images are already loaded (for cached images)
  useEffect(() => {
    const checkImageLoaded = (ref: React.RefObject<HTMLImageElement | null>, imageName: string) => {
      if (ref.current && ref.current.complete && ref.current.naturalWidth > 0) {
        handleImageLoad(imageName);
      }
    };

    // Small delay to ensure refs are set
    setTimeout(() => {
      checkImageLoaded(imageRefs.left, 'left');
      checkImageLoaded(imageRefs.right, 'right');
    }, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white relative">
      {/* Background SVG - inlined for instant render */}
      <LandingBgSvg 
        aria-hidden="true"
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
            <LogoSvg className="h-6 w-auto" aria-label="Logo" />
          </div>
          <div className="flex items-center gap-4">
            {hasCourses && (
              <Link
                href="/courses"
                className="flex items-center justify-center h-10 px-4 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors text-xs font-medium animate-fade-in"
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
            <LandingHeroPoweredBySvg 
              className="h-8 w-auto"
              aria-label="Made & powered by together.ai"
            />
          </a>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          {/* Decorative elements - kept as img with fixed dimensions to prevent layout shift */}
          <img 
            ref={imageRefs.left}
            src="/landing-left.svg" 
            alt="" 
            width={320}
            height={320}
            onLoad={() => handleImageLoad('left')}
            onError={() => handleImageError('left')}
            className={`hidden md:block absolute left-0 top-0 w-80 h-80 z-0 transition-opacity duration-500 ease-out ${loadedImages.has('left') ? 'opacity-100' : 'opacity-0'}`}
          />

          <img 
            ref={imageRefs.right}
            src="/landing-right.svg" 
            alt="" 
            width={320}
            height={320}
            onLoad={() => handleImageLoad('right')}
            onError={() => handleImageError('right')}
            className={`hidden md:block absolute right-0 top-0 w-80 h-80 z-0 transition-opacity duration-500 ease-out ${loadedImages.has('right') ? 'opacity-100' : 'opacity-0'}`}
          />

          <h1 className="relative text-7xl font-bold text-neutral-900 mb-6 leading-none font-[family-name:var(--font-fustat)] z-10">
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
              className={`relative border-2 border-dashed rounded-3xl p-8 md:p-16 transition-all backdrop-blur-sm min-h-[200px] flex flex-col items-center justify-center ${
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
                    id="file-upload"
                    className="hidden"
                    accept=".pdf,.json,application/json"
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
                    <p className="text-xs text-neutral-400 mt-2">
                      JSON upload available for debugging purposes
                    </p>
                  </label>

                  {error && (
                    <div className="w-full mt-6 p-4 md:p-5 bg-red-100 border border-red-300 rounded-xl">
                      <p className="text-red-700 text-sm md:text-base leading-relaxed text-center">{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Try Demo Button */}
            {!isProcessing && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleTryDemo}
                  className="px-6 py-2.5 bg-white text-neutral-700 rounded-full font-medium hover:bg-neutral-50 transition-colors border border-neutral-300 inline-flex items-center gap-2"
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Try Demo Course
                </button>
              </div>
            )}
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
          <LandingFooterPoweredBySvg 
            className="h-6 w-auto"
            aria-label="Powered by together.ai"
          />
        </a>
      </footer>

      {/* Social Icons */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3 z-10">
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
    </div>
  );
}

export { LandingScreen };
