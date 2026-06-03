import { NextRequest, NextResponse } from "next/server";
import demoCourse from "@/lib/demo/composer2-course.json";
import { saveCourse } from "@/lib/save-course";
import { handleApiError } from "@/lib/utils/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId =
      request.headers.get("X-User-ID") ||
      request.headers.get("X-Session-ID") ||
      undefined;

    if (!userId) {
      return NextResponse.json(
        { error: "Session id is required" },
        { status: 401 }
      );
    }

    const savedCourse = await saveCourse({
      course: demoCourse,
      userId,
    });

    return NextResponse.json(savedCourse, { status: 201 });
  } catch (error) {
    console.error("Error creating demo course:", error);
    return handleApiError(error, "Failed to create demo course");
  }
}
