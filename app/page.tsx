"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandingScreen } from "./components/landing-screen";
import { getStoredCourses } from "@/lib/storage";
import type { Course } from "./hooks/use-course-navigation";
import { saveCourse } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

  // Check for saved courses on mount and redirect to dashboard
  useEffect(() => {
    const savedCourses = getStoredCourses();
    if (savedCourses.length > 0) {
      router.push("/courses");
    }
  }, [router]);

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
