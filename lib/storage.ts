import type { Course } from "@/app/hooks/use-course-navigation";
import { generateSlug, ensureUniqueSlug } from "./utils/slug";

export interface StoredCourse {
  id: string;
  slug?: string; // Optional for backward compatibility with old courses
  course: Course;
  progress: {
    currentModuleIndex: number;
    currentLessonIndex: number;
    completedModules: number[];
    totalModules: number;
    totalLessons: number;
    completedLessons: number;
  };
  createdAt: string;
  lastAccessedAt: string;
}

const STORAGE_KEY = "pdf-courses";

/**
 * Get all stored courses from localStorage
 */
export function getStoredCourses(): StoredCourse[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load courses from localStorage:", error);
    return [];
  }
}

/**
 * Save a new course to localStorage
 */
export function saveCourse(course: Course): string {
  const courses = getStoredCourses();
  const id = Date.now().toString();

  const totalModules = course.modules.length;
  const totalLessons = course.modules.reduce(
    (sum, mod) => sum + mod.lessons.filter((l) => l.success).length,
    0
  );

  // Generate slug and ensure uniqueness
  const baseSlug = generateSlug(course.title, id);
  const existingSlugs = courses
    .map((c) => c.slug)
    .filter((s): s is string => !!s); // Filter out undefined/null slugs
  const slug = ensureUniqueSlug(baseSlug, existingSlugs);

  const newCourse: StoredCourse = {
    id,
    slug,
    course,
    progress: {
      currentModuleIndex: 0,
      currentLessonIndex: 0,
      completedModules: [],
      totalModules,
      totalLessons,
      completedLessons: 0,
    },
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  };

  courses.push(newCourse);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));

  return id;
}
