"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ModulesScreen } from "@/app/components/modules-screen";
import { getCourseBySlug } from "@/lib/storage";
import type { StoredCourse } from "@/lib/storage";
import type { Course } from "@/app/hooks/use-course-navigation";

export default function CoursePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [completedModules, setCompletedModules] = useState<number[]>([]);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getCourseBySlug(slug);
    if (!stored) {
      setError("Course not found");
      setLoading(false);
      return;
    }

    setCourse(stored.course);
    setCompletedModules(stored.progress.completedModules);
    setCurrentModuleIndex(stored.progress.currentModuleIndex);
    setLoading(false);
    
    // Update page title dynamically
    document.title = `${stored.course.title} | PDF to Interactive Lesson Generator`;
  }, [slug]);

  const handleStartModule = (moduleIndex: number) => {
    router.push(`/course/${slug}/module/${moduleIndex}`);
  };

  if (loading) {
    return null;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">Course not found</h1>
          <p className="text-neutral-600 mb-6">{error || "The course you're looking for doesn't exist."}</p>
          <button
            onClick={() => router.push("/courses")}
            className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <ModulesScreen
      course={course}
      onStartModule={handleStartModule}
      completedModules={completedModules}
      currentModuleIndex={currentModuleIndex}
    />
  );
}

