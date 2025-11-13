"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { getApiKey } from "@/lib/api-key-storage";
import { saveCourse, updateCourseSlug } from "@/lib/storage";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import { getStoredCourses } from "@/lib/storage";
import type { Course } from "@/app/hooks/use-course-navigation";
import { useCredits } from "../hooks/use-credits";
import { ApiKeyDialog } from "../components/api-key-dialog";
import Link from "next/link";
import { Github, Twitter, Key } from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";
import { useImageFadeIn } from "../hooks/use-image-fade-in";

function GeneratingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateCredits } = useCredits();
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasStarted = useRef(false);
  const logoFadeIn = useImageFadeIn("/logo.svg");
  const creatingGuyFadeIn = useImageFadeIn("/creating-guy.svg");
  const footerFadeIn = useImageFadeIn("/landing-footer-powered-by.svg");

  useEffect(() => {
    if (hasStarted.current) return;

    // First check for file in sessionStorage (immediate redirect from upload)
    const pendingFileData = sessionStorage.getItem("pendingPdfUpload");
    if (pendingFileData) {
      hasStarted.current = true;
      sessionStorage.removeItem("pendingPdfUpload"); // Clear it immediately
      
      try {
        const fileData = JSON.parse(pendingFileData);
        // Convert base64 back to File
        const byteCharacters = atob(fileData.data.split(",")[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new File([byteArray], fileData.name, { type: fileData.type });
        
        handleFileUpload(file);
      } catch (error) {
        console.error("Failed to process pending file:", error);
        setError("Failed to process file. Please try uploading again.");
        setIsProcessing(false);
      }
      return;
    }

    // Fallback: Get file URL from query params if provided (for direct links)
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("fileName");

    if (fileUrl && fileName) {
      hasStarted.current = true;
      handleGenerateFromUrl(fileUrl, fileName);
      return;
    }

    // No file or URL provided, redirect back to courses
    router.push("/courses");
  }, [searchParams, router]);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setProgress("Uploading PDF to storage...");

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setError("API key not configured. Please add your Together AI API key in settings.");
        setIsProcessing(false);
        return;
      }

      // Check file size as a rough proxy for page count
      const estimatedPages = Math.ceil(file.size / (100 * 1024));
      if (estimatedPages > 100) {
        throw new Error(
          `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
        );
      }

      // Upload to Vercel Blob
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-url",
      });

      // Continue with generation (skip setting processing state since we're already processing)
      await handleGenerateFromUrl(blob.url, file.name, true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload file. Please try again.";
      
      let displayError = errorMessage;
      if (errorMessage.includes("pages") && errorMessage.includes("100")) {
        displayError = "This PDF is too large. We currently support PDFs up to 100 pages. Please split your document into smaller sections or upload a shorter version.";
      } else if (errorMessage.includes("credits")) {
        displayError = errorMessage;
      } else if (errorMessage.includes("API key")) {
        displayError = errorMessage;
      }
      
      setError(displayError);
      setIsProcessing(false);
    }
  };

  const handleGenerateFromUrl = async (url: string, fileName: string, skipProcessingState = false) => {
    if (!skipProcessingState) {
      setIsProcessing(true);
    }
    setError(null);
    setProgress("Generating course from PDF...");

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setError("API key not configured. Please add your Together AI API key in settings.");
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append("url", url);

      const response = await fetch("/api/generate-course", {
        method: "POST",
        headers: {
          "X-Together-API-Key": apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          throw new Error(
            errorData.message || `Insufficient credits.`
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
              // Update grading credits from completion data if available
              if (event.data?.gradingCreditsRemaining !== undefined) {
                updateCredits(event.data.gradingCreditsRemaining);
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

      // Save course and navigate to it
      const courseId = saveCourse(courseData);
      const courses = getStoredCourses();
      const course = courses.find((c) => c.id === courseId);

      if (course) {
        // Ensure slug exists
        if (!course.slug) {
          const baseSlug = generateSlug(course.course.title, course.id);
          const existingSlugs = courses
            .map((c) => c.slug)
            .filter(Boolean) as string[];
          const slug = ensureUniqueSlug(baseSlug, existingSlugs);
          updateCourseSlug(courseId, slug);
          router.push(`/course/${slug}`);
        } else {
          router.push(`/course/${course.slug}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process PDF. Please try again.";

      let displayError = errorMessage;
      if (errorMessage.includes("pages") && errorMessage.includes("100")) {
        displayError = "This PDF is too large. We currently support PDFs up to 100 pages. Please split your document into smaller sections or upload a shorter version.";
      } else if (errorMessage.includes("credits")) {
        displayError = errorMessage;
      } else if (errorMessage.includes("API key")) {
        displayError = errorMessage;
      }

      setError(displayError);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
          <div className="flex items-center gap-4">
            <Link
              href="/courses"
              className="flex items-center justify-center h-10 px-4 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors text-xs font-medium"
              aria-label="Courses"
            >
              Courses
            </Link>
            <button 
              onClick={() => setIsApiKeyDialogOpen(true)}
              className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
              aria-label="API Key"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center bg-white relative">
        <div className="max-w-2xl w-full px-8 flex-1 flex flex-col items-center justify-center pb-64 relative z-10">
          <div className="flex flex-col items-center justify-center">
            {error ? (
              <div className="w-full">
                <div className="flex items-start gap-3 mb-6">
                  <svg
                    className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
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
                    <h2 className="text-red-800 font-semibold text-lg mb-2">Error</h2>
                    <p className="text-red-700 text-sm leading-relaxed mb-4">{error}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/courses"
                    className="px-6 py-3 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors"
                  >
                    Back to Courses
                  </Link>
                  <button
                    onClick={() => {
                      setError(null);
                      setIsProcessing(false);
                      hasStarted.current = false;
                      router.push("/courses");
                    }}
                    className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-full font-medium hover:bg-neutral-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <Loader size={48} className="mb-8 text-blue-500 [animation-duration:0.6s]" />
                <p className="text-neutral-900 font-bold text-4xl mb-6">{progress}</p>
                <p className="text-sm text-neutral-500">
                  This may take a few minutes...
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Creating Guy Illustration at Bottom - Clipping with Footer */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center z-0" style={{ marginBottom: '0px' }}>
          <img 
            ref={creatingGuyFadeIn.imgRef}
            src="/creating-guy.svg" 
            alt="Creating illustration"
            onLoad={creatingGuyFadeIn.handleLoad}
            onError={creatingGuyFadeIn.handleError}
            className={`h-auto max-w-md w-full transition-opacity duration-700 ease-out ${creatingGuyFadeIn.isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t-[0.5px] border-neutral-200 px-4 py-4 flex items-center justify-between relative z-10">
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

export default function GeneratingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader size={48} className="text-blue-500" />
      </div>
    }>
      <GeneratingPageContent />
    </Suspense>
  );
}

