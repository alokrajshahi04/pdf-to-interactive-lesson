import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import {
  isExplicitlyPublicCourse,
  withCourseSharingMetadata,
} from "@/lib/course-visibility";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import { eq, desc } from "drizzle-orm";
import { handleApiError } from "@/lib/utils/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestUserId(request: NextRequest): string | null {
  return request.headers.get("X-User-ID") || request.headers.get("X-Session-ID");
}

// GET /api/courses - List courses owned by this browser/session
export async function GET(request: NextRequest) {
  try {
    const userId = getRequestUserId(request);

    if (!userId) {
      return NextResponse.json(
        { courses: [], total: 0 },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const ownedCourses = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        courseData: courses.courseData,
        isPublic: courses.isPublic,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.createdBy, userId))
      .orderBy(desc(courses.createdAt));

    const allCourses = ownedCourses.map((course) => ({
      ...course,
      isPublic: isExplicitlyPublicCourse(course.courseData, course.isPublic),
    }));

    return NextResponse.json({
      courses: allCourses,
      total: allCourses.length,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return handleApiError(error, "Failed to fetch courses");
  }
}

// POST /api/courses - Create a new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { course, slug: providedSlug } = body;
    const userId = getRequestUserId(request);

    if (!course || !course.title) {
      return NextResponse.json(
        { error: "Course data with title is required" },
        { status: 400 }
      );
    }

    let slug = providedSlug;
    if (!slug) {
      const baseSlug = generateSlug(course.title, Date.now().toString());

      const existingSlugs: string[] = [];
      const allCourses = await db.select({ slug: courses.slug }).from(courses);
      existingSlugs.push(...allCourses.map((c) => c.slug));

      slug = ensureUniqueSlug(baseSlug, existingSlugs);
    } else {
      const existing = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: "A course with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const isPublic = body.isPublic === true;

    const [newCourse] = await db
      .insert(courses)
      .values({
        slug,
        title: course.title,
        courseData: isPublic ? withCourseSharingMetadata(course, true) : course,
        createdBy: userId || null,
        isPublic,
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
    return handleApiError(error, "Failed to create course");
  }
}
