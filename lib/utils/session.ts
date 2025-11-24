/**
 * User ID management for tracking user progress
 * For anonymous users, generates a session-based ID stored in localStorage
 * When authentication is added, this will return the real user ID
 */

const STORAGE_KEY = 'user_session_id';

/**
 * Get or create a unique user ID for this browser
 * For anonymous users: generates a session ID that persists across page reloads
 * For authenticated users: will return the real user ID (future implementation)
 */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    // Generate a unique session ID using timestamp + random string
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Clear the user ID (useful for testing or reset)
 */
export function clearUserId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// Backwards compatibility aliases
export const getOrCreateSessionId = getOrCreateUserId;
export const clearSessionId = clearUserId;

