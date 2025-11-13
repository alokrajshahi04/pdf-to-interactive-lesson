"use client";

import { useRouter } from "next/navigation";
import { LandingScreen } from "./components/landing-screen";
import { getStoredCourses } from "@/lib/storage";
import type { Course } from "./hooks/use-course-navigation";
import { saveCourse } from "@/lib/storage";

export function HomeClient() {
  const router = useRouter();

  const handleCourseGenerated = (generatedCourse: Course) => {
    const courseId = saveCourse(generatedCourse);
    const stored = getStoredCourses().find((c) => c.id === courseId);
    if (stored?.slug) {
      router.push(`/course/${stored.slug}`);
    }
  };

  return (
    <LandingScreen
      onCourseGenerated={handleCourseGenerated}
    />
  );
}

