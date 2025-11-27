import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import { eq, desc } from "drizzle-orm";

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
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Database not configured. Please set DATABASE_URL environment variable." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create a new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { course, slug: providedSlug } = body;
    const userId = request.headers.get("X-User-ID") || request.headers.get("X-Session-ID"); // Optional: track course creator

    if (!course || !course.title) {
      return NextResponse.json(
        { error: "Course data with title is required" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    let slug = providedSlug;
    if (!slug) {
      const baseSlug = generateSlug(course.title, Date.now().toString());
      
      // Check if slug exists and ensure uniqueness
      const existingSlugs: string[] = [];
      const allCourses = await db.select({ slug: courses.slug }).from(courses);
      existingSlugs.push(...allCourses.map((c) => c.slug));
      
      slug = ensureUniqueSlug(baseSlug, existingSlugs);
    } else {
      // Check if provided slug already exists
      const existing = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: "A course with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Insert course into database
    const [newCourse] = await db
      .insert(courses)
      .values({
        slug,
        title: course.title,
        courseData: course,
        createdBy: userId || null, // Track creator (anonymous or authenticated)
        isPublic: true,
      })
      .returning();

    return NextResponse.json({
      id: newCourse.id,
      slug: newCourse.slug,
      title: newCourse.title,
      createdAt: newCourse.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Database not configured. Please set DATABASE_URL environment variable." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}

