"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiKeyDialog } from "./api-key-dialog";

interface HeaderActionsProps {
  showCoursesLink?: boolean;
}

function HeaderActions({ showCoursesLink }: HeaderActionsProps) {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  return (
    <>
      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog} />
      <div className="flex items-center gap-2 flex-shrink-0">
        {showCoursesLink && (
          <Link
            href="/courses"
            className="flex items-center gap-1.5 h-9 px-3 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-600 hover:text-neutral-900 transition-colors text-xs font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Courses
          </Link>
        )}
        <button
          onClick={() => setShowApiKeyDialog(true)}
          className="flex items-center gap-1.5 h-9 px-3 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer text-xs font-medium"
          aria-label="API Key"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          API Key
        </button>
      </div>
    </>
  );
}

export { HeaderActions };
