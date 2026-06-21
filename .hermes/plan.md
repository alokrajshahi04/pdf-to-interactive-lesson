# Project Plan: pdf-to-interactive-lesson Client Upgrade

## Goal
Transform pdf-to-interactive-lesson from a simple upload tool into a client-grade SaaS with premium landing page, auth, pricing, and credits system.

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind v4
- Drizzle ORM + Neon Postgres
- Clerk Auth
- Stripe (planned, not integrated yet)
- Vercel (deploy target: lesson.tolti.app)

## Parallel Tasks

### Task 1: Premium Landing Page
**Scope:** `app/components/landing-screen.tsx`, `app/page.tsx`, `app/layout.tsx` (header), `app/globals.css`
- Design a premium SaaS landing page with:
  - Hero section with animated gradient or particle background
  - Clear value proposition + upload CTA
  - Feature grid (AI-powered, interactive, progress tracking, shareable)
  - Social proof / trust badges
  - How it works section (re-use `landing-steps.tsx` but polish)
  - Footer (polish existing `footer.tsx`)
- Add dark mode toggle support (system preference default)
- Update nav in `layout.tsx` to show Sign In / Sign Up / Dashboard links
- Update metadata/SEO for `lesson.tolti.app`
- Keep existing upload flow working exactly as-is

### Task 2: Clerk Auth + DB Migration  
**Scope:** `package.json`, `middleware.ts`, `lib/db/schema.ts`, `lib/db/index.ts`, all `app/api/*` routes, `app/layout.tsx` (Clerk provider)
- Install `@clerk/nextjs`
- Setup `middleware.ts` with public routes (`/`, `/pricing`, `/course/*`, `/api/*` selectively)
- Add Clerk provider to `layout.tsx`
- Add `users` table to Drizzle schema:
  - id (uuid, pk), clerkId (text, unique), email (text), name (text), avatarUrl (text), plan (text, default 'free'), createdAt, updatedAt
- Add `credits` table:
  - id (uuid, pk), userId (text, notNull), amount (integer, default 0), type (text: 'free'|'purchased'|'subscription'), createdAt
- Add `subscriptions` table (for Stripe later):
  - id (uuid, pk), userId (text, notNull), stripeCustomerId (text), stripeSubscriptionId (text), status (text), plan (text), currentPeriodEnd (timestamp), createdAt, updatedAt
- Run `db:generate` and `db:push` (or create migration files)
- Update ALL API routes to use `auth()` from Clerk instead of `X-User-ID` header / `getOrCreateUserId()`
  - `/api/courses` GET/POST/DELETE
  - `/api/demo-course`
  - `/api/generate-course`
  - `/api/upload-url`
  - `/api/grade-short-answer`
  - etc.
- Update `courses.createdBy` to store Clerk `userId` instead of session ID
- Backwards compatibility: if `auth()` returns null (unauthed), fall back to session ID for free tier OR return 401 where appropriate
- Add user button / sign-out to header

### Task 3: Pricing Page + Dashboard + Credits Shell
**Scope:** New files mostly: `app/pricing/page.tsx`, `app/dashboard/page.tsx`, `app/components/pricing-cards.tsx`, `app/components/user-menu.tsx`
- Create `/pricing` page with 3 tiers:
  - **Free**: 3 PDFs/mo, basic lessons, no API key needed
  - **Pro** ($9/mo): 50 PDFs/mo, advanced AI, analytics, priority support
  - **Enterprise** ($29/mo): Unlimited, custom branding, API access, dedicated support
- Use existing design system (Tailwind, card styles from dashboard)
- Create `/dashboard` route that renders the existing `dashboard.tsx` component but with:
  - Authenticated user gate (redirect to sign-in if unauthed)
  - Credits balance display in header
  - Upgrade CTA if on free plan
- Create `user-menu.tsx` dropdown component (avatar, name, plan badge, dashboard link, billing link, sign out)
- Create Stripe stubs (no real integration yet):
  - `lib/stripe.ts` client initialization
  - `app/api/stripe/checkout-session/route.ts` (stub returning 501)
  - `app/api/stripe/webhook/route.ts` (stub)
  - `.env.example` updates for Stripe keys
- Update `next.config.ts` if needed for new routes

## Post-Merge Checklist
- [] All agents complete
- [] Resolve any file conflicts (especially `app/layout.tsx`, `lib/db/schema.ts`)
- [] Run `pnpm install` to ensure new deps
- [] Run `pnpm lint` to catch issues
- [] Run `pnpm db:generate` and `pnpm db:push` for schema changes
- [] Test local dev: landing page, sign-up, upload, dashboard, pricing
- [] Deploy to Vercel preview
- [] Configure lesson.tolti.app DNS
- [] Configure Clerk allowed origins for lesson.tolti.app

## Target Domain
`lesson.tolti.app`
