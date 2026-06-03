import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: "error",
          database: "not_configured",
          message: "DATABASE_URL environment variable is not set",
        },
        { status: 500 }
      );
    }

    const [{ db }, { courses }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ]);

    // Try to query the database
    await db.select().from(courses).limit(1);

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "connection_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
