/**
 * Simple in-memory credits system
 * 
 * For production, consider using:
 * - Database (PostgreSQL, MongoDB)
 * - Redis for distributed systems
 * - Vercel KV or Edge Config
 */

interface CreditsRecord {
  credits: number;
  lastUpdated: number;
}

interface CourseCountRecord {
  count: number;
  lastUpdated: number;
}

class CreditsManager {
  private records: Map<string, CreditsRecord> = new Map();
  private initialCredits: number;

  constructor(initialCredits: number = 12) {
    this.initialCredits = initialCredits;
    // Clean up old records every 10 minutes (optional - for memory management)
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Get current credits for a user
   * @param identifier - Unique identifier (e.g., IP address, API key, user ID)
   * @returns Current credit balance
   */
  getCredits(identifier: string): number {
    const record = this.records.get(identifier);
    if (!record) {
      // Initialize with initial credits
      this.records.set(identifier, {
        credits: this.initialCredits,
        lastUpdated: Date.now(),
      });
      return this.initialCredits;
    }
    return record.credits;
  }

  /**
   * Check if user has enough credits and deduct if available
   * @param identifier - Unique identifier
   * @param amount - Amount to deduct (default: 1)
   * @returns Object with success status and remaining credits
   */
  deductCredits(
    identifier: string,
    amount: number = 1
  ): {
    success: boolean;
    creditsRemaining: number;
    creditsUsed: number;
  } {
    const record = this.records.get(identifier);

    if (!record) {
      // Initialize with initial credits
      const newRecord: CreditsRecord = {
        credits: this.initialCredits,
        lastUpdated: Date.now(),
      };
      this.records.set(identifier, newRecord);

      if (this.initialCredits >= amount) {
        newRecord.credits -= amount;
        return {
          success: true,
          creditsRemaining: newRecord.credits,
          creditsUsed: amount,
        };
      } else {
        return {
          success: false,
          creditsRemaining: this.initialCredits,
          creditsUsed: 0,
        };
      }
    }

    if (record.credits < amount) {
      return {
        success: false,
        creditsRemaining: record.credits,
        creditsUsed: 0,
      };
    }

    // Deduct credits
    record.credits -= amount;
    record.lastUpdated = Date.now();

    return {
      success: true,
      creditsRemaining: record.credits,
      creditsUsed: amount,
    };
  }

  /**
   * Add credits to a user's account
   * @param identifier - Unique identifier
   * @param amount - Amount to add
   */
  addCredits(identifier: string, amount: number): void {
    const record = this.records.get(identifier);
    if (!record) {
      this.records.set(identifier, {
        credits: this.initialCredits + amount,
        lastUpdated: Date.now(),
      });
    } else {
      record.credits += amount;
      record.lastUpdated = Date.now();
    }
  }

  /**
   * Reset credits for a user (useful for testing or admin actions)
   * @param identifier - Unique identifier
   */
  resetCredits(identifier: string): void {
    this.records.set(identifier, {
      credits: this.initialCredits,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Clean up old records (optional - for memory management)
   * Keeps records that were updated in the last 24 hours
   */
  private cleanup(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (const [key, record] of this.records.entries()) {
      if (now - record.lastUpdated > oneDayMs) {
        this.records.delete(key);
      }
    }
  }
}

/**
 * Manager to track how many courses each client has created
 */
class CourseCountManager {
  private records: Map<string, CourseCountRecord> = new Map();

  /**
   * Get the number of courses created by a client
   * @param identifier - Unique identifier (e.g., IP address, API key, user ID)
   * @returns Number of courses created
   */
  getCourseCount(identifier: string): number {
    const record = this.records.get(identifier);
    return record?.count || 0;
  }

  /**
   * Increment the course count for a client
   * @param identifier - Unique identifier
   * @returns The new course count
   */
  incrementCourseCount(identifier: string): number {
    const record = this.records.get(identifier);
    if (!record) {
      this.records.set(identifier, {
        count: 1,
        lastUpdated: Date.now(),
      });
      return 1;
    }
    record.count += 1;
    record.lastUpdated = Date.now();
    return record.count;
  }

  /**
   * Reset course count for a client (useful for testing)
   * @param identifier - Unique identifier
   */
  resetCourseCount(identifier: string): void {
    this.records.set(identifier, {
      count: 0,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Clean up old records (optional - for memory management)
   * Keeps records that were updated in the last 24 hours
   */
  cleanup(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (const [key, record] of this.records.entries()) {
      if (now - record.lastUpdated > oneDayMs) {
        this.records.delete(key);
      }
    }
  }
}

/**
 * Manager for grading credits based on courses created
 * Grading credits = number of courses created
 */
class GradingCreditsManager {
  private courseCountManager: CourseCountManager;
  private usedCredits: Map<string, number> = new Map();

  constructor(courseCountManager: CourseCountManager) {
    this.courseCountManager = courseCountManager;
    // Clean up old records every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Get available grading credits for a client
   * Credits = courses created - credits already used
   * @param identifier - Unique identifier
   * @returns Available grading credits
   */
  getCredits(identifier: string): number {
    const coursesCreated = this.courseCountManager.getCourseCount(identifier);
    const used = this.usedCredits.get(identifier) || 0;
    return Math.max(0, coursesCreated - used);
  }

  /**
   * Deduct grading credits
   * @param identifier - Unique identifier
   * @param amount - Amount to deduct (default: 1)
   * @returns Object with success status and remaining credits
   */
  deductCredits(
    identifier: string,
    amount: number = 1
  ): {
    success: boolean;
    creditsRemaining: number;
    creditsUsed: number;
  } {
    const coursesCreated = this.courseCountManager.getCourseCount(identifier);
    const currentlyUsed = this.usedCredits.get(identifier) || 0;
    const available = coursesCreated - currentlyUsed;

    if (available < amount) {
      // Return current state (no change since deduction failed)
      return {
        success: false,
        creditsRemaining: available,
        creditsUsed: currentlyUsed, // Total credits used at time of response (no change)
      };
    }

    // Deduct credits
    const newUsed = currentlyUsed + amount;
    this.usedCredits.set(identifier, newUsed);

    // Return updated state (after successful deduction)
    return {
      success: true,
      creditsRemaining: coursesCreated - newUsed,
      creditsUsed: newUsed, // Total credits used at time of response (after deduction)
    };
  }

  /**
   * Clean up old records
   */
  private cleanup(): void {
    // Note: We keep used credits indefinitely since they're tied to course count
    // In production, you might want to reset used credits periodically
  }
}

// Create course count manager instance
export const courseCountManager = new CourseCountManager();

// Create grading credits manager that uses course count
export const gradeAnswerCreditsManager = new GradingCreditsManager(courseCountManager);

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

