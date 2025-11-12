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

/**
 * Update course progress
 */
export function updateCourseProgress(
  courseId: string,
  progress: Partial<StoredCourse["progress"]>
): void {
  const courses = getStoredCourses();
  const courseIndex = courses.findIndex((c) => c.id === courseId);

  if (courseIndex === -1) return;

  courses[courseIndex].progress = {
    ...courses[courseIndex].progress,
    ...progress,
  };
  courses[courseIndex].lastAccessedAt = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

/**
 * Update course data (e.g., when grading results are added)
 */
export function updateCourseData(courseId: string, course: Course): void {
  const courses = getStoredCourses();
  const courseIndex = courses.findIndex((c) => c.id === courseId);

  if (courseIndex === -1) return;

  courses[courseIndex].course = course;
  courses[courseIndex].lastAccessedAt = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

/**
 * Get a specific course by ID
 */
export function getCourse(courseId: string): StoredCourse | null {
  const courses = getStoredCourses();
  return courses.find((c) => c.id === courseId) || null;
}

/**
 * Update a course's slug (for migration)
 */
export function updateCourseSlug(courseId: string, slug: string): void {
  const courses = getStoredCourses();
  const courseIndex = courses.findIndex((c) => c.id === courseId);
  if (courseIndex !== -1) {
    courses[courseIndex].slug = slug;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  }
}

/**
 * Get a specific course by slug
 * Migrates courses without slugs automatically
 */
export function getCourseBySlug(slug: string): StoredCourse | null {
  const courses = getStoredCourses();
  
  // Collect ALL existing slugs FIRST before migration to ensure proper collision detection
  const existingSlugs: string[] = courses
    .map((c) => c.slug)
    .filter((s): s is string => !!s); // Filter out undefined/null slugs
  
  // Migrate courses without slugs
  let needsMigration = false;
  const migratedCourses = courses.map((course) => {
    if (!course.slug) {
      needsMigration = true;
      const baseSlug = generateSlug(course.course.title, course.id);
      const newSlug = ensureUniqueSlug(baseSlug, existingSlugs);
      // Add the newly generated slug to existingSlugs to prevent collisions with subsequent courses
      existingSlugs.push(newSlug);
      return {
        ...course,
        slug: newSlug,
      };
    }
    return course;
  });

  if (needsMigration) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedCourses));
  }

  const course = migratedCourses.find((c) => c.slug === slug) || null;
  return course;
}

/**
 * Delete a course
 */
export function deleteCourse(courseId: string): void {
  const courses = getStoredCourses();
  const filtered = courses.filter((c) => c.id !== courseId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Calculate completion percentage
 */
export function getCompletionPercentage(storedCourse: StoredCourse): number {
  const { completedLessons, totalLessons } = storedCourse.progress;
  if (totalLessons === 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
}
