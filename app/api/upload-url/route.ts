import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Optional: Add validation or authentication here
        // For now, we'll allow all PDF uploads
        return {
          allowedContentTypes: ["application/pdf"],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            // Optional: Add metadata here
          }),
        };
      },
      onUploadCompleted: async () => {
        // Optional: Handle post-upload tasks here
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
