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

// Create credits manager instance
// Users start with 12 credits
export const gradeAnswerCreditsManager = new CreditsManager(12);

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

