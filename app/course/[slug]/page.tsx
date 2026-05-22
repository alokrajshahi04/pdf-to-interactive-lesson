"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ModulesScreen } from "@/app/components/modules-screen";
import { Button } from "@/app/components/ui/button";
import { ModuleListSkeleton } from "@/app/components/ui/skeleton";
import { getCourseProgress, deriveCurrentModuleIndex } from "@/lib/course-progress";
import type { Course } from "@/lib/types";

export default function CoursePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [completedModules, setCompletedModules] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProgress = useCallback(() => {
    const progress = getCourseProgress(slug);
    setCompletedModules(progress?.completedModules || []);
  }, [slug]);

  useEffect(() => {
    const fetchCourseAndProgress = async () => {
      try {
        setLoading(true);
        
        // Fetch course from database
        const courseResponse = await fetch(`/api/courses/${slug}`);
        
        if (!courseResponse.ok) {
          if (courseResponse.status === 404) {
            setError("Course not found");
          } else {
            const errorData = await courseResponse.json().catch(() => null);
            const detail = errorData?.error || `Server error (${courseResponse.status})`;
            setError(detail);
          }
          setLoading(false);
          return;
        }

        const courseData = await courseResponse.json();
        setCourse(courseData.course);

        // Load user's progress from localStorage
        refreshProgress();
        
        setLoading(false);
        
        // Update page title dynamically
        document.title = `${courseData.course.title} | PDF to Interactive Lesson Generator`;
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("Failed to load course. Please check your connection.");
        setLoading(false);
      }
    };

    fetchCourseAndProgress();
  }, [slug, refreshProgress]);

  // Refresh progress when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProgress();
      }
    };

    const handleFocus = () => {
      refreshProgress();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshProgress]);

  const handleStartModule = (moduleIndex: number) => {
    router.push(`/course/${slug}/module/${moduleIndex}`);
  };

  const handleJumpToLesson = (moduleIndex: number, lessonIndex: number) => {
    // Jump directly to a specific lesson at the content step
    router.push(`/course/${slug}/module/${moduleIndex}?step=content&lesson=${lessonIndex}`);
  };

  if (loading) {
    return <ModuleListSkeleton />;
  }

  if (error || !course) {
    const isNotFound = error === "Course not found";
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">
            {isNotFound ? "Course not found" : "Failed to load course"}
          </h1>
          <p className="text-neutral-600 mb-6">{error || "The course you’re looking for doesn’t exist."}</p>
          <Button shape="lg" onClick={() => router.push("/courses")}>
            Back to courses
          </Button>
        </div>
      </div>
    );
  }

  const effectiveModuleIndex = deriveCurrentModuleIndex(completedModules, course.modules.length);
  const allComplete = course.modules.length > 0 && completedModules.length >= course.modules.length;

  return (
    <ModulesScreen
      course={course}
      courseSlug={slug}
      onStartModule={handleStartModule}
      onJumpToLesson={handleJumpToLesson}
      completedModules={completedModules}
      currentModuleIndex={effectiveModuleIndex}
      allComplete={allComplete}
    />
  );
}

