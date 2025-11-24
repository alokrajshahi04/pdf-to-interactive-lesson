/**
 * Local storage for course progress (per browser)
 * Courses are shared via DB, but progress is personal and stored locally
 */

export interface CourseProgress {
  slug: string;
  currentModuleIndex: number;
  currentLessonIndex: number;
  completedModules: number[];
  lastAccessedAt: string;
}

const STORAGE_KEY = 'course-progress';

/**
 * Get all course progress from localStorage
 */
export function getAllProgress(): Record<string, CourseProgress> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load progress from localStorage:', error);
    return {};
  }
}

/**
 * Get progress for a specific course
 */
export function getCourseProgress(slug: string): CourseProgress | null {
  const allProgress = getAllProgress();
  const progress = allProgress[slug] || null;
  console.log('[PROGRESS GET] Slug:', slug, '| Found:', !!progress, '| Completed:', progress?.completedModules);
  return progress;
}

/**
 * Save progress for a specific course
 */
export function saveCourseProgress(progress: CourseProgress): void {
  if (typeof window === 'undefined') return;
  
  try {
    const allProgress = getAllProgress();
    allProgress[progress.slug] = {
      ...progress,
      lastAccessedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    console.log('[PROGRESS SAVE] Slug:', progress.slug, '| Completed:', progress.completedModules, '| Saved to localStorage');
  } catch (error) {
    console.error('Failed to save progress to localStorage:', error);
  }
}

/**
 * Update specific fields of course progress
 */
export function updateCourseProgress(
  slug: string,
  updates: Partial<Omit<CourseProgress, 'slug'>>
): void {
  const existing = getCourseProgress(slug);
  const progress: CourseProgress = {
    slug,
    currentModuleIndex: updates.currentModuleIndex ?? existing?.currentModuleIndex ?? 0,
    currentLessonIndex: updates.currentLessonIndex ?? existing?.currentLessonIndex ?? 0,
    completedModules: updates.completedModules ?? existing?.completedModules ?? [],
    lastAccessedAt: new Date().toISOString(),
  };
  saveCourseProgress(progress);
}

/**
 * Clear progress for a specific course
 */
export function clearCourseProgress(slug: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const allProgress = getAllProgress();
    delete allProgress[slug];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
  } catch (error) {
    console.error('Failed to clear progress from localStorage:', error);
  }
}

