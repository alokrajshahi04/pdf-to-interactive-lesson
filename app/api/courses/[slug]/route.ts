import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/courses/[slug] - Fetch a course by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    // Fetch course from database
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Check if course is public
    if (!course.isPublic) {
      return NextResponse.json(
        { error: "Course is not public" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: course.id,
      slug: course.slug,
      title: course.title,
      course: course.courseData,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }, {
      headers: {
        // Cache for 5 minutes
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Database not configured. Please set DATABASE_URL environment variable." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[slug] - Delete a course by slug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    // Delete the course
    const result = await db
      .delete(courses)
      .where(eq(courses.slug, slug))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Database not configured. Please set DATABASE_URL environment variable." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}

