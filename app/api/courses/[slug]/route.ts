import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import {
  isExplicitlyPublicCourse,
  withCourseSharingMetadata,
} from "@/lib/course-visibility";
import { and, eq } from "drizzle-orm";
import { handleApiError } from "@/lib/utils/api-errors";
import { getAuthUserId } from "@/lib/utils/clerk-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/courses/[slug] - Fetch a course by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthUserId(request);

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

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

    const isOwner = !!userId && course.createdBy === userId;
    const isPublic = isExplicitlyPublicCourse(course.courseData, course.isPublic);

    if (!isPublic && !isOwner) {
      return NextResponse.json(
        { error: "Course is private" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: course.id,
      slug: course.slug,
      title: course.title,
      course: course.courseData,
      isPublic,
      isOwner,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    return handleApiError(error, "Failed to fetch course");
  }
}

// PATCH /api/courses/[slug] - Update course visibility
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthUserId(request);

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { error: "isPublic must be a boolean" },
        { status: 400 }
      );
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.slug, slug), eq(courses.createdBy, userId)))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { error: "Course not found or you do not have permission to update it" },
        { status: 404 }
      );
    }

    const courseData =
      typeof course.courseData === "object" &&
      course.courseData !== null &&
      !Array.isArray(course.courseData)
        ? withCourseSharingMetadata(
            course.courseData as Record<string, unknown>,
            body.isPublic
          )
        : course.courseData;

    const [updatedCourse] = await db
      .update(courses)
      .set({
        isPublic: body.isPublic,
        courseData,
        updatedAt: new Date(),
      })
      .where(and(eq(courses.slug, slug), eq(courses.createdBy, userId)))
      .returning({
        slug: courses.slug,
        isPublic: courses.isPublic,
        courseData: courses.courseData,
        updatedAt: courses.updatedAt,
      });

    return NextResponse.json({
      slug: updatedCourse.slug,
      isPublic: isExplicitlyPublicCourse(
        updatedCourse.courseData,
        updatedCourse.isPublic
      ),
      updatedAt: updatedCourse.updatedAt,
    });
  } catch (error) {
    console.error("Error updating course:", error);
    return handleApiError(error, "Failed to update course");
  }
}

// DELETE /api/courses/[slug] - Delete a course by slug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthUserId(request);

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const result = await db
      .delete(courses)
      .where(and(eq(courses.slug, slug), eq(courses.createdBy, userId)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Course not found or you do not have permission to delete it" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return handleApiError(error, "Failed to delete course");
  }
}
