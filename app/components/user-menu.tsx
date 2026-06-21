"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Settings,
  CreditCard,
  HelpCircle,
  LogOut,
  User,
  Crown,
} from "lucide-react";

type UserPlan = "Free" | "Pro" | "Enterprise";

interface UserMenuProps {
  user?: {
    name: string;
    email?: string;
    avatarUrl?: string;
    plan?: UserPlan;
  } | null;
  onSignOut?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function PlanBadge({ plan }: { plan?: UserPlan }) {
  if (!plan) return null;
  const styles: Record<UserPlan, string> = {
    Free: "bg-surface-muted text-neutral-600",
    Pro: "bg-brand-3/10 text-brand-3",
    Enterprise: "bg-brand-4/10 text-brand-4",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[plan]}`}
    >
      <Crown className="w-3 h-3" />
      {plan}
    </span>
  );
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const displayName = user?.name || "Guest";
  const displayEmail = user?.email || "";
  const plan = user?.plan || "Free";

  const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Billing", href: "/billing", icon: CreditCard },
    { label: "Support", href: "mailto:support@pdftolesson.com", icon: HelpCircle },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-surface-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open user menu"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="h-8 w-8 rounded-full bg-neutral-900 text-white text-xs font-semibold flex items-center justify-center">
              {getInitials(displayName)}
            </span>
          )}
          <span className="hidden sm:block text-sm font-medium text-neutral-700 max-w-[120px] truncate">
            {displayName}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="end" sideOffset={6}>
        <div className="px-3 py-2 mb-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {displayName}
            </p>
            <PlanBadge plan={plan} />
          </div>
          {displayEmail && (
            <p className="text-xs text-neutral-500 truncate">{displayEmail}</p>
          )}
        </div>

        <div className="border-t border-border my-1" />

        <nav className="flex flex-col gap-0.5">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-surface-muted transition-colors"
            >
              <item.icon className="w-4 h-4 text-neutral-400" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border my-1" />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-neutral-700 hover:text-incorrect hover:bg-incorrect-bg"
          onClick={() => {
            setOpen(false);
            onSignOut?.();
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
