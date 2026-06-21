import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events (checkout.session.completed, invoice.paid, etc).
 *
 * Stub — returns 501 Not Implemented until the webhook handler is wired.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Stripe webhook handler is not implemented yet.",
      hint: "Verify the webhook signature with STRIPE_WEBHOOK_SECRET and update the user's subscription in the database.",
    },
    { status: 501 }
  );
}
