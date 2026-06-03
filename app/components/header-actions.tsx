"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BookOpen, KeyRound } from "lucide-react";
import { useCredits } from "../hooks/use-credits";
import { ApiKeyDialog } from "./api-key-dialog";
import { Button, buttonVariants } from "./ui/button";
import { getApiKey } from "@/lib/api-key-storage";

const API_KEY_CHANGE_EVENT = "api-key-storage-change";

interface HeaderActionsProps {
  showCoursesLink?: boolean;
}

function subscribeToApiKeyChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(API_KEY_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(API_KEY_CHANGE_EVENT, onStoreChange);
  };
}

function getApiKeyPresence() {
  return !!getApiKey();
}

function getServerApiKeyPresence() {
  return null;
}

function HeaderActions({ showCoursesLink }: HeaderActionsProps) {
  const { credits, loaded } = useCredits();
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  // null = not checked yet (avoids SSR flicker); true = key present, hide chip.
  const hasApiKey = useSyncExternalStore(
    subscribeToApiKeyChanges,
    getApiKeyPresence,
    getServerApiKeyPresence
  );

  const handleApiKeyDialogChange = (open: boolean) => {
    setShowApiKeyDialog(open);
    if (!open) {
      // Re-check after the dialog closes so the chip hides on save / reappears on remove.
      window.dispatchEvent(new Event(API_KEY_CHANGE_EVENT));
    }
  };

  const showCreditsChip = hasApiKey !== true;

  return (
    <>
      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={handleApiKeyDialogChange} />
      <div className="flex items-center gap-2 flex-shrink-0">
        {showCreditsChip && (!loaded ? (
          // Reserve the chip immediately so it appears with the rest of the
          // header; the number fills in once the credit check resolves.
          <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-surface-muted text-sm text-neutral-400 cursor-default select-none">
            <span className="inline-block w-3 h-3.5 rounded bg-neutral-200 animate-pulse motion-reduce:animate-none" />
            <span className="hidden sm:inline">courses left</span>
            <span className="sm:hidden">left</span>
          </div>
        ) : credits ? (
          <div
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-surface-muted text-sm text-neutral-500 cursor-default select-none"
            title={`${credits.coursesRemaining} free courses remaining`}
          >
            <span className="font-semibold text-neutral-900 tabular-nums">
              {credits.coursesRemaining}
            </span>
            <span className="hidden sm:inline">courses left</span>
            <span className="sm:hidden">left</span>
          </div>
        ) : null)}
        {showCoursesLink && (
          <Link
            href="/courses"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Courses
          </Link>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowApiKeyDialog(true)}
          aria-label="API Key"
        >
          <KeyRound className="w-3.5 h-3.5" />
          API Key
        </Button>
      </div>
    </>
  );
}

export { HeaderActions };
