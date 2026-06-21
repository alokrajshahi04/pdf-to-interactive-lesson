"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Dashboard } from "../components/dashboard";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { getOrCreateUserId } from "@/lib/utils/session";
import { Zap, CreditCard, Crown } from "lucide-react";

type UserPlan = "Free" | "Pro" | "Enterprise";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  credits: number;
}

function PlanBadge({ plan }: { plan: UserPlan }) {
  const styles = {
    Free: "bg-surface-muted text-neutral-600",
    Pro: "bg-brand-3/10 text-brand-3",
    Enterprise: "bg-brand-4/10 text-brand-4",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[plan]}`}
    >
      <Crown className="w-3 h-3" />
      {plan}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-12 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function DashboardWrapper() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Skeleton auth gate — checks local session and falls back to anonymous user.
    // Swap this for Clerk auth() once authentication is fully wired.
    const sessionId = getOrCreateUserId();
    const mockUser: AuthUser = {
      id: sessionId,
      name: "Guest User",
      email: "",
      plan: "Free",
      credits: 3,
    };

    // Attempt to read any persisted plan/credits from localStorage stubs
    try {
      const storedPlan = localStorage.getItem("user_plan") as UserPlan | null;
      const storedCredits = localStorage.getItem("user_credits");
      if (storedPlan) mockUser.plan = storedPlan;
      if (storedCredits) mockUser.credits = parseInt(storedCredits, 10);
    } catch {
      // ignore
    }

    setUser(mockUser);
    setAuthChecked(true);
  }, []);

  if (!authChecked) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      {/* Credits & plan banner */}
      <div className="w-full border-b-[0.5px] border-border bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <CreditCard className="w-4 h-4 text-neutral-400" />
              <span className="tabular-nums font-semibold text-neutral-900">
                {user?.credits ?? 0}
              </span>
              <span>PDFs remaining</span>
            </div>
            <PlanBadge plan={user?.plan ?? "Free"} />
          </div>
          {user?.plan === "Free" && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-neutral-500 hidden sm:block">
                Unlock more PDFs and premium features
              </p>
              <Link href="/pricing">
                <Button variant="primary" size="sm" shape="pill">
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade CTA banner for free users */}
      {user?.plan === "Free" && (
        <div className="w-full bg-gradient-to-r from-brand-1/5 via-brand-2/5 to-brand-3/5 border-b-[0.5px] border-border">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">
                You&apos;re on the Free plan.
              </span>{" "}
              Upgrade to Pro for 50 PDFs/month, advanced AI, and analytics.
            </p>
            <Link href="/pricing" className="flex-shrink-0">
              <Button variant="outline" size="sm" shape="pill">
                See plans
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main dashboard */}
      <Dashboard />
    </div>
  );
}
