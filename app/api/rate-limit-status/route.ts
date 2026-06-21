import { NextRequest, NextResponse } from "next/server";
import {
  getRateLimitStatus,
  getClientIdentifier,
} from "@/lib/utils/rate-limiter";

// Force dynamic to ensure we always get fresh data
export const dynamic = "force-dynamic";

/**
 * GET /api/rate-limit-status
 * Returns the current rate limit status for the requesting client
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const status = await getRateLimitStatus(clientId);

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching rate limit status:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate limit status" },
      { status: 500 }
    );
  }
}
