import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { handleApiError } from "@/lib/utils/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/courses - List all public courses
export async function GET() {
  try {
    // Fetch all public courses, ordered by creation date (newest first)
    const allCourses = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        courseData: courses.courseData,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.isPublic, true))
      .orderBy(desc(courses.createdAt));

    return NextResponse.json({
      courses: allCourses,
      total: allCourses.length,
    }, {
      headers: {
        // Cache for 1 minute
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return handleApiError(error, "Failed to fetch courses");
  }
}

