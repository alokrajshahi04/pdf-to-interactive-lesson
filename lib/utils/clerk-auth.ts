import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

/**
 * Get the authenticated user ID from Clerk, falling back to session-based ID
 * for anonymous free-tier users.
 *
 * Use this for routes that should support both authenticated and anonymous users.
 */
export async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const { userId } = await auth();
  if (userId) return userId;

  // Fall back to anonymous session ID for free tier
  return request.headers.get("X-User-ID") || request.headers.get("X-Session-ID");
}

/**
 * Get the authenticated user ID from Clerk only.
 * Returns null if the user is not authenticated with Clerk.
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Require authentication. Returns the Clerk userId or throws a 401 response.
 *
 * Use this for protected routes (e.g. DELETE, PATCH) that should only work
 * for signed-in users.
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
