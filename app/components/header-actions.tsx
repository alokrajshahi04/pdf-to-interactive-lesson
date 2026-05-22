"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, KeyRound } from "lucide-react";
import { useCredits } from "../hooks/use-credits";
import { ApiKeyDialog } from "./api-key-dialog";
import { Button, buttonVariants } from "./ui/button";

interface HeaderActionsProps {
  showCoursesLink?: boolean;
}

function HeaderActions({ showCoursesLink }: HeaderActionsProps) {
  const { credits, loaded } = useCredits();
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  return (
    <>
      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog} />
      <div className="flex items-center gap-2 flex-shrink-0">
        {!loaded ? (
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
        ) : null}
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
