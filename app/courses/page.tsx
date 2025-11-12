"use client";

import { Dashboard } from "../components/dashboard";
import { useRouter } from "next/navigation";
import { getStoredCourses, updateCourseSlug, saveCourse } from "@/lib/storage";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import type { Course } from "../hooks/use-course-navigation";

export default function CoursesPage() {
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
    const courseId = saveCourse(generatedCourse);
    const stored = getStoredCourses().find((c) => c.id === courseId);
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

