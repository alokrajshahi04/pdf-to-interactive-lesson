import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stripe/checkout-session
 * Creates a Stripe Checkout Session for subscription upgrades.
 *
 * Stub — returns 501 Not Implemented until the billing integration is wired.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Stripe checkout session is not implemented yet.",
      hint: "Wire up STRIPE_SECRET_KEY and create a checkout session using the Stripe SDK.",
    },
    { status: 501 }
  );
}
