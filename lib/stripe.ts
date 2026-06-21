import Stripe from "stripe";

/**
 * Stripe client initialization.
 *
 * This is a stub ready for full checkout session and webhook integration.
 * Ensure STRIPE_SECRET_KEY is set in your environment before using.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

/**
 * Publishable key used on the client for Stripe.js Elements.
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
