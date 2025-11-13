"use client";

import { Dashboard } from "../components/dashboard";
import { useRouter } from "next/navigation";
import { getStoredCourses, updateCourseSlug } from "@/lib/storage";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import type { Course } from "../hooks/use-course-navigation";

export function CoursesClient() {
  const router = useRouter();

  const handleSelectCourse = (courseId: string) => {
    // Find course by ID
    const courses = getStoredCourses();
    const course = courses.find((c) => c.id === courseId);
    
    if (!course) {
      console.error("Course not found:", courseId);
      return;
    }

    // If course doesn't have a slug, generate one and migrate
    if (!course.slug) {
      const baseSlug = generateSlug(course.course.title, course.id);
      const existingSlugs = courses
        .map((c) => c.slug)
        .filter(Boolean) as string[];
      const slug = ensureUniqueSlug(baseSlug, existingSlugs);
      
      // Update the course with the slug
      updateCourseSlug(courseId, slug);
      
      router.push(`/course/${slug}`);
    } else {
      router.push(`/course/${course.slug}`);
    }
  };

  const handleCourseGenerated = (generatedCourse: Course) => {
    // Course is already saved by Dashboard component, just navigate to it
    const courses = getStoredCourses();
    // Find the most recently created course (should be the one we just generated)
    const stored = courses
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (stored?.slug) {
      router.push(`/course/${stored.slug}`);
    }
  };

  return (
    <Dashboard
      onSelectCourse={handleSelectCourse}
      onCourseGenerated={handleCourseGenerated}
    />
  );
}

