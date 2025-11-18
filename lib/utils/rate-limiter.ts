/**
 * Rate limiting utility using Upstash Redis
 * 
 * Allows 1 free course per IP address (lifetime).
 * Users with their own Together AI API key bypass rate limiting entirely.
 */

import { Redis } from '@upstash/redis';

// Initialize Redis from environment variables
const redis = Redis.fromEnv();

/**
 * Get client identifier from request
 * Uses IP address, falling back to a header if available
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback: use a default identifier (not ideal, but works)
  return "unknown";
}

// Constants
const FREE_COURSE_LIMIT = 1;
const RATE_LIMIT_KEY_PREFIX = 'rate-limit:';

interface RateLimitResult {
  allowed: boolean;
  coursesCreated: number;
  limit: number;
}

interface RateLimitStatus {
  coursesCreated: number;
  limit: number;
  hasReachedLimit: boolean;
}

/**
 * Check if a client is allowed to generate a course
 * @param clientId - Unique identifier (e.g., IP address)
 * @param hasApiKey - Whether the user has provided their own API key
 * @returns Object with allowed status, current count, and limit
 */
export async function checkRateLimit(
  clientId: string,
  hasApiKey: boolean
): Promise<RateLimitResult> {
  // If user has their own API key, bypass rate limiting entirely
  if (hasApiKey) {
    return {
      allowed: true,
      coursesCreated: 0,
      limit: Infinity,
    };
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}${clientId}`;
  
  try {
    // Get current course count from Redis
    const count = await redis.get<number>(key);
    const coursesCreated = count || 0;

    return {
      allowed: coursesCreated < FREE_COURSE_LIMIT,
      coursesCreated,
      limit: FREE_COURSE_LIMIT,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // On error, be permissive and allow the request
    return {
      allowed: true,
      coursesCreated: 0,
      limit: FREE_COURSE_LIMIT,
    };
  }
}

/**
 * Increment the course count for a client (call after successful generation)
 * @param clientId - Unique identifier (e.g., IP address)
 * @returns The new course count
 */
export async function incrementRateLimit(clientId: string): Promise<number> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${clientId}`;
  
  try {
    // Increment the counter in Redis
    const newCount = await redis.incr(key);
    
    // Set expiry to 1 year (for cleanup, though this is essentially "lifetime")
    await redis.expire(key, 60 * 60 * 24 * 365);
    
    return newCount;
  } catch (error) {
    console.error('Error incrementing rate limit:', error);
    return 0;
  }
}

/**
 * Get current rate limit status for a client without incrementing
 * @param clientId - Unique identifier (e.g., IP address)
 * @returns Current status with course count and limit info
 */
export async function getRateLimitStatus(
  clientId: string
): Promise<RateLimitStatus> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${clientId}`;
  
  try {
    const count = await redis.get<number>(key);
    const coursesCreated = count || 0;

    return {
      coursesCreated,
      limit: FREE_COURSE_LIMIT,
      hasReachedLimit: coursesCreated >= FREE_COURSE_LIMIT,
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return {
      coursesCreated: 0,
      limit: FREE_COURSE_LIMIT,
      hasReachedLimit: false,
    };
  }
}

