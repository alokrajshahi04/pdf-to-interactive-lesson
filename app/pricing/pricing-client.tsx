"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { HeaderActions } from "../components/header-actions";
import { Footer } from "../components/footer";

interface PricingTier {
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  features: string[];
  cta: string;
  ctaVariant: "primary" | "secondary" | "outline";
  highlighted?: boolean;
  planBadge?: string;
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    description: "Get started with AI-powered lessons",
    features: [
      "3 PDFs per month",
      "Basic AI generation",
      "Standard support",
      "Public courses",
    ],
    cta: "Get started free",
    ctaVariant: "secondary",
    planBadge: "Free",
  },
  {
    name: "Pro",
    priceMonthly: 9,
    priceAnnual: 7,
    description: "Perfect for educators and creators",
    features: [
      "50 PDFs per month",
      "Advanced AI generation",
      "Analytics dashboard",
      "Priority support",
      "Private courses",
    ],
    cta: "Start Pro trial",
    ctaVariant: "primary",
    highlighted: true,
    planBadge: "Pro",
  },
  {
    name: "Enterprise",
    priceMonthly: 29,
    priceAnnual: 24,
    description: "For teams and organizations",
    features: [
      "Unlimited PDFs",
      "Custom branding",
      "API access",
      "Dedicated support",
      "SSO & advanced security",
    ],
    cta: "Contact sales",
    ctaVariant: "outline",
    planBadge: "Enterprise",
  },
];

function PricingCard({
  tier,
  isAnnual,
}: {
  tier: PricingTier;
  isAnnual: boolean;
}) {
  const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;

  return (
    <div
      className={`relative flex flex-col p-6 sm:p-8 rounded-2xl border-[0.5px] bg-white transition-all duration-200 ease-standard ${
        tier.highlighted
          ? "border-brand-3 shadow-lg scale-[1.02] ring-1 ring-brand-3/20"
          : "border-border card-hover"
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-3/10 text-brand-3 px-3 py-1 text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            Recommended
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-neutral-900">{tier.name}</h3>
        <p className="text-sm text-neutral-500 mt-1">{tier.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-neutral-900 tracking-tight">
            ${price}
          </span>
          <span className="text-sm text-neutral-500">/mo</span>
        </div>
        {isAnnual && tier.priceAnnual > 0 && (
          <p className="text-xs text-neutral-400 mt-1">
            Billed annually (${tier.priceAnnual * 12}/year)
          </p>
        )}
        {!isAnnual && tier.priceMonthly > 0 && (
          <p className="text-xs text-neutral-400 mt-1">
            Billed monthly
          </p>
        )}
        {price === 0 && (
          <p className="text-xs text-neutral-400 mt-1">No credit card required</p>
        )}
      </div>

      <ul className="flex-1 space-y-3 mb-8">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-neutral-700">
            <Check className="w-4 h-4 text-correct flex-shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={tier.ctaVariant}
        size="md"
        shape="pill"
        className="w-full"
      >
        {tier.cta}
      </Button>
    </div>
  );
}

export function PricingClient() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b-[0.5px] border-border bg-white w-full">
        <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Go to PDF to Lesson home page"
            className="flex items-center gap-2.5 text-neutral-950"
          >
            <img src="/logo.svg" alt="" className="h-6 w-auto" />
            <span className="font-sans text-lg font-bold leading-none tracking-normal whitespace-nowrap">
              PDF to Lesson
            </span>
          </Link>
          <HeaderActions showCoursesLink />
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4 tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees.
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span
              className={`text-sm font-medium ${
                !isAnnual ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-7 w-12 items-center rounded-full bg-neutral-200 transition-colors duration-200 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Toggle annual billing"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-standard ${
                  isAnnual ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                isAnnual ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              Annual
            </span>
            <span className="ml-1 rounded-full bg-correct-bg text-correct-fg px-2 py-0.5 text-xs font-semibold">
              Save 20%
            </span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {tiers.map((tier) => (
              <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual} />
            ))}
          </div>

          {/* FAQ teaser */}
          <div className="mt-16 text-center">
            <p className="text-sm text-neutral-500">
              Questions?{" "}
              <a
                href="mailto:support@pdftolesson.com"
                className="font-medium text-neutral-900 underline underline-offset-2"
              >
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t-[0.5px] border-border">
        <Footer />
      </footer>
    </div>
  );
}
