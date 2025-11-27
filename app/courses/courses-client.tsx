"use client";

import { Dashboard } from "../components/dashboard";
import { useRouter } from "next/navigation";
import type { Course } from "../hooks/use-course-navigation";

export function CoursesClient() {
  const router = useRouter();

  const handleSelectCourse = (courseId: string) => {
    // With database-backed courses, the Dashboard component handles navigation
    // This is kept for compatibility but not actively used
    void courseId;
  };

  const handleCourseGenerated = (generatedCourse: Course) => {
    // Course is already saved by Dashboard component
    // Navigation happens in the upload flow
    void generatedCourse;
  };

  return (
    <Dashboard
      onSelectCourse={handleSelectCourse}
      onCourseGenerated={handleCourseGenerated}
    />
  );
}

