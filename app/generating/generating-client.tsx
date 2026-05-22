"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { Check } from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";
import { getApiKey } from "@/lib/api-key-storage";
import { getPendingFile } from "@/lib/utils/indexed-db-storage";
import { getOrCreateUserId } from "@/lib/utils/session";
import { HeaderActions } from "../components/header-actions";
import { ApiKeyDialog } from "../components/api-key-dialog";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import { Callout } from "../components/ui/callout";
import { useImageFadeIn } from "../hooks/use-image-fade-in";

const STAGES = [
  { key: "upload", label: "Uploading" },
  { key: "read", label: "Reading" },
  { key: "structure", label: "Structuring" },
  { key: "build", label: "Building lessons" },
  { key: "ready", label: "Ready" },
] as const;

function stageIndex(progress: string, status: string, isQueued: boolean): number {
  if (status === "complete" || /redirect|course ready|complete/i.test(progress)) return 4;
  const p = progress.toLowerCase();
  if (isQueued) return 0;
  if (/upload/.test(p)) return 0;
  if (/read|ocr|extract|pars/.test(p)) return 1;
  if (/structur|outline|plan|module/.test(p)) return 2;
  if (/generat|lesson|build|creat|writ/.test(p)) return 3;
  return 0;
}

export function GeneratingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(false);
  const [status, setStatus] = useState<string>("processing");
  const [lastUpload, setLastUpload] = useState<{ url: string; fileName: string } | null>(null);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const hasStarted = useRef(false);
  const logoFadeIn = useImageFadeIn("/logo.svg");

  useEffect(() => {
    if (hasStarted.current) return;

    const initializeUpload = async () => {
      try {
        const file = await getPendingFile();
        if (file) {
          hasStarted.current = true;
          handleFileUpload(file);
          return;
        }
      } catch (error) {
        console.error("Failed to retrieve pending file:", error);
        setError("Failed to retrieve file. Please try uploading again.");
        setIsProcessing(false);
        return;
      }

      const fileUrl = searchParams.get("url");
      const fileName = searchParams.get("fileName");

      if (fileUrl && fileName) {
        hasStarted.current = true;
        handleGenerateFromUrl(fileUrl, fileName);
        return;
      }

      router.push("/courses");
    };

    initializeUpload();
  }, [searchParams, router]);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setProgress("Uploading PDF to storage...");

    try {
      const estimatedPages = Math.ceil(file.size / (100 * 1024));
      if (estimatedPages > 100) {
        throw new Error(
          `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
        );
      }

      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload-url",
      });

      setLastUpload({ url: blob.url, fileName: file.name });
      await handleGenerateFromUrl(blob.url, file.name, true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload file. Please try again.";

      let displayError = errorMessage;
      if (errorMessage.includes("pages") && errorMessage.includes("100")) {
        displayError = "This PDF is too large. We currently support PDFs up to 100 pages. Please split your document into smaller sections or upload a shorter version.";
      } else if (errorMessage.includes("credits")) {
        displayError = errorMessage;
      } else if (errorMessage.includes("API key") || errorMessage.includes("free course")) {
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
    setIsQueued(false);
    setProgress("Generating course from PDF...");

    setLastUpload({ url, fileName });

    try {
      const apiKey = getApiKey();
      const userId = getOrCreateUserId();

      const formData = new FormData();
      formData.append("url", url);

      const headers: Record<string, string> = {
        "X-User-ID": userId,
      };
      if (apiKey) {
        headers["X-Together-API-Key"] = apiKey;
      }

      const enqueueResponse = await fetch("/api/generate-course", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!enqueueResponse.ok) {
        const errorData = await enqueueResponse.json();
        if (enqueueResponse.status === 402) {
          throw new Error(errorData.message || `Insufficient credits.`);
        }
        throw new Error(errorData.error || "Failed to generate course");
      }

      const { jobId } = (await enqueueResponse.json()) as { jobId: string };
      if (!jobId) {
        throw new Error("No jobId returned from server");
      }

      const POLL_INTERVAL_MS = 1500;
      const MAX_POLL_MS = 20 * 60 * 1000;
      const startedAt = Date.now();

      let courseSlug: string | null = null;

      while (Date.now() - startedAt < MAX_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const statusResponse = await fetch(
          `/api/generate-course/status?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" }
        );

        if (!statusResponse.ok) {
          if (statusResponse.status === 404) {
            throw new Error("Job expired before completing. Please try again.");
          }
          continue;
        }

        const state = await statusResponse.json();

        if (state.status === "queued") {
          setIsQueued(true);
          setStatus("queued");
          setProgress("Waiting in line...");
        } else if (state.status === "processing") {
          setIsQueued(false);
          setStatus("processing");
          if (state.progress) {
            setProgress(state.progress);
          }
        } else if (state.status === "complete") {
          setStatus("complete");
          courseSlug = state.slug;
          break;
        } else if (state.status === "error") {
          throw new Error(state.error || "Unknown error occurred during course generation");
        }
      }

      if (!courseSlug) {
        throw new Error("Course generation timed out. Please try again.");
      }

      setProgress("Course ready! Redirecting...");
      router.push(`/course/${courseSlug}`);
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

  const isApiKeyError = error?.toLowerCase().includes("api key") || error?.toLowerCase().includes("invalid api");

  const handleApiKeyDialogChange = (open: boolean) => {
    setIsApiKeyDialogOpen(open);
    if (!open && lastUpload) {
      const key = getApiKey();
      if (key) {
        setError(null);
        handleGenerateFromUrl(lastUpload.url, lastUpload.fileName);
      }
    }
  };

  const current = stageIndex(progress, status, isQueued);
  const isComplete = status === "complete";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ApiKeyDialog
        open={isApiKeyDialogOpen}
        onOpenChange={handleApiKeyDialogChange}
        message={isApiKeyError ? "Add your Together AI API key to continue generating your course." : undefined}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b-[0.5px] border-border bg-white w-full">
        <div className="h-full px-6 md:px-8 flex items-center justify-between">
          <Link href="/">
            <img
              ref={logoFadeIn.imgRef}
              src="/logo.svg"
              alt="Logo"
              onLoad={logoFadeIn.handleLoad}
              onError={logoFadeIn.handleError}
              className={`h-6 w-auto transition-opacity duration-500 ease-out ${logoFadeIn.isLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </Link>
          <HeaderActions showCoursesLink />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {error ? (
          <div className="w-full max-w-md">
            <Callout variant="incorrect" title="Failed to generate course" className="mb-6">
              <p className="text-sm leading-relaxed">{error}</p>
            </Callout>
            <div className="flex flex-wrap gap-3 justify-center">
              {isApiKeyError ? (
                <Button onClick={() => setIsApiKeyDialogOpen(true)}>Add API Key</Button>
              ) : (
                <Button
                  onClick={() => {
                    if (lastUpload) {
                      setError(null);
                      handleGenerateFromUrl(lastUpload.url, lastUpload.fileName);
                    } else {
                      router.push("/courses");
                    }
                  }}
                >
                  Try again
                </Button>
              )}
              <Button variant="secondary" onClick={() => router.push("/courses")}>
                Back to courses
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <img
              src="/creating-guy.webp"
              alt=""
              aria-hidden="true"
              width={210}
              height={163}
              className="w-24 h-auto mb-6 select-none"
            />

            <h1 className="text-2xl font-bold text-neutral-900 tracking-[-0.02em]">
              {isComplete ? "Your course is ready!" : "Building your course"}
            </h1>
            <p className="text-sm text-neutral-500 mt-1.5 min-h-5">
              {isQueued
                ? "Waiting in line — this starts as soon as a slot opens."
                : progress}
            </p>

            {/* Step checklist */}
            <ol className="mt-8 flex flex-col items-start gap-1">
              {STAGES.map((s, i) => {
                const done = isComplete || i < current;
                const active = !isComplete && i === current;
                return (
                  <li
                    key={s.key}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors duration-300 ${
                      active ? "bg-surface-muted" : ""
                    }`}
                  >
                    {done ? (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-correct">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </span>
                    ) : active ? (
                      <Loader size={20} className="flex-shrink-0 text-neutral-900" />
                    ) : (
                      <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-neutral-200" />
                    )}
                    <span
                      className={`text-sm ${
                        active
                          ? "text-neutral-900 font-semibold"
                          : done
                          ? "text-neutral-500"
                          : "text-neutral-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>

      <footer className="bg-white border-t-[0.5px] border-border relative z-10">
        <Footer />
      </footer>
    </div>
  );
}
