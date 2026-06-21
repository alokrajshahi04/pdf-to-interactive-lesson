import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/course/(.*)",
  "/generating",
  "/courses",
  "/api/(.*)",
]);

// Temporary: skip Clerk auth if keys are not configured (prevents 500s during setup)
const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const sk = process.env.CLERK_SECRET_KEY;
const clerkConfigured =
  pk && (pk.startsWith("pk_test_") || pk.startsWith("pk_live_")) &&
  sk && (sk.startsWith("sk_test_") || sk.startsWith("sk_live_"));

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
