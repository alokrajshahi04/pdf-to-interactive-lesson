"use client";

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "@/lib/api-key-storage";
import { getOrCreateUserId } from "@/lib/utils/session";
import { getCourseProgress } from "@/lib/course-progress";
import { storePendingFile } from "@/lib/utils/indexed-db-storage";
import type { Course } from "@/lib/types";
import { HeaderActions } from "./header-actions";
import { ApiKeyDialog } from "./api-key-dialog";
import { Footer } from "./footer";
import Link from "next/link";
import { Upload, Trash2 } from "lucide-react";
import { useImageFadeIn } from "../hooks/use-image-fade-in";
import { Button } from "./ui/button";
import { Callout } from "./ui/callout";
import { CourseGridSkeleton } from "./ui/skeleton";
import { Loader } from "@/components/ai-elements/loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface DatabaseCourse {
  id: string;
  slug: string;
  title: string;
  courseData: Course;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

function CourseCard({
  course,
  onDelete,
}: {
  course: DatabaseCourse;
  onDelete: (course: DatabaseCourse) => void;
}) {
  const progress = getCourseProgress(course.slug);
  const modules = course.courseData?.modules || [];
  const totalModules = modules.filter(
    (m: { lessons?: { success: boolean }[] }) => m.lessons?.some((l) => l.success)
  ).length;
  const completedModules = progress?.completedModules?.length || 0;
  const progressPercent =
    totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <article className="card-hover relative p-6 rounded-2xl border-[0.5px] border-border bg-white">
      {/* Stretched link overlay — keyboard-focusable, navigates the whole card */}
      <Link
        href={`/course/${course.slug}`}
        aria-label={`Open ${course.title}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(course);
        }}
        className="interactive absolute top-4 right-4 z-10 p-2 text-neutral-400 hover:text-incorrect hover:bg-incorrect-bg rounded-full"
        aria-label={`Delete ${course.title}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <h3 className="text-xl font-bold text-neutral-900 mb-2 pr-8">
        {course.title}
      </h3>

      <p className="mb-3 text-xs font-medium text-neutral-500">
        {course.isPublic ? "Public" : "Private"}
      </p>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-neutral-600">
            {completedModules} of {totalModules} modules
          </span>
          <span
            className={`text-xs font-semibold tabular-nums ${
              progressPercent > 0 ? "text-correct" : "text-neutral-400"
            }`}
          >
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-correct rounded-full transition-[width] duration-300 ease-standard"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-neutral-400 mt-3">
        Created {new Date(course.createdAt).toLocaleDateString()}
      </p>
    </article>
  );
}

function Dashboard() {
  const [courses, setCourses] = useState<DatabaseCourse[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<DatabaseCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFadeIn = useImageFadeIn("/logo.svg");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoadingCourses(true);
        const userId = getOrCreateUserId();
        const response = await fetch("/api/courses", {
          headers: {
            "X-User-ID": userId,
          },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to load courses");
        }
        const data = await response.json();
        setCourses(data.courses || []);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchCourses();
  }, []);

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const userId = getOrCreateUserId();
      const response = await fetch(`/api/courses/${courseToDelete.slug}`, {
        method: "DELETE",
        headers: {
          "X-User-ID": userId,
        },
      });
      if (response.ok) {
        setCourses((prev) => prev.filter((c) => c.slug !== courseToDelete.slug));
        setCourseToDelete(null);
      } else {
        const errorData = await response.json().catch(() => null);
        setDeleteError(errorData?.error || "Failed to delete course. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting course:", error);
      setDeleteError("Failed to delete course. Please try again.");
    } finally {
      setIsDeleting(false);
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
      } else {
        setError("Please upload a PDF file");
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        await handleFileUpload(file);
      } else {
        setError("Please upload a PDF file");
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setProgress("Preparing PDF...");

    const estimatedPages = Math.ceil(file.size / (100 * 1024));
    if (estimatedPages > 100) {
      setError(
        `This PDF appears to be very large (~${estimatedPages} pages). We currently only support PDFs up to 100 pages. Please upload a shorter document.`
      );
      setIsProcessing(false);
      return;
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      try {
        const response = await fetch("/api/rate-limit-status");
        const rateLimitStatus = await response.json();

        if (rateLimitStatus.hasReachedCourseLimit) {
          setError("You've used all 3 free courses! Add your Together AI API key to generate unlimited courses.");
          setIsApiKeyDialogOpen(true);
          setIsProcessing(false);
          return;
        }
      } catch (error) {
        console.error("Failed to check rate limit:", error);
      }
    }

    try {
      await storePendingFile(file);
      window.location.href = "/generating";
    } catch (error) {
      console.error("Failed to store file:", error);
      setError("Failed to process file. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <ApiKeyDialog
        open={isApiKeyDialogOpen}
        onOpenChange={setIsApiKeyDialogOpen}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!courseToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setCourseToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-left">Delete this course?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">
              {courseToDelete?.title}
            </span>{" "}
            will be permanently removed. This can&rsquo;t be undone.
          </p>
          {deleteError && (
            <Callout variant="incorrect" className="text-sm">
              {deleteError}
            </Callout>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              shape="lg"
              onClick={() => {
                setCourseToDelete(null);
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              shape="lg"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <HeaderActions />
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Sticky sidebar */}
        <aside className="w-full lg:w-96 lg:flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-border p-8 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900 mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-neutral-600">
              Pick up where you left off, or start a fresh course from any PDF.
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`lg:h-64 border-[0.5px] border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-[border-color,background-color] duration-200 ease-standard ${
              isDragging
                ? "border-neutral-400 bg-surface-subtle"
                : "border-border-strong bg-white"
            } ${!isProcessing ? "cursor-pointer" : ""}`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center text-center">
                <Loader size={28} className="mb-4 text-neutral-900" />
                <p className="text-neutral-700 font-medium">{progress}</p>
                <p className="text-sm text-neutral-500 mt-2">
                  Redirecting to generation…
                </p>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="pdf-upload"
                  disabled={isProcessing}
                />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={isProcessing}
                  className="mb-3"
                >
                  <Upload className="w-4 h-4" />
                  Upload a PDF
                </Button>
                <p className="text-sm text-neutral-500">Or drag-and-drop here</p>
                <p className="text-xs text-neutral-400 mt-2">
                  PDFs up to 100 pages
                </p>
              </>
            )}
          </div>

          {error && (
            <Callout variant="incorrect" title="Couldn’t upload" className="mt-4 text-sm">
              {error}
            </Callout>
          )}
        </aside>

        {/* Course list */}
        <main className="flex-1 p-6 lg:p-12 bg-neutral-50">
          <div className="max-w-7xl mx-auto">
            {isLoadingCourses ? (
              <CourseGridSkeleton count={4} />
            ) : courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border-[0.5px] border-dashed border-border bg-white">
                <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center mb-4">
                  <Upload className="w-5 h-5 text-neutral-400" />
                </div>
                <p className="text-neutral-900 font-semibold mb-1">No courses yet</p>
                <p className="text-neutral-500 text-sm">
                  Upload a PDF to generate your first course.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onDelete={setCourseToDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="bg-white border-t-[0.5px] border-border">
        <Footer />
      </footer>
    </div>
  );
}

export { Dashboard };
