"use client";

import { useState, useEffect } from "react";
import { Key } from "lucide-react";
import Link from "next/link";
import { getApiKey } from "@/lib/api-key-storage";
import { ApiKeyDialog } from "./api-key-dialog";
import { useCredits } from "../hooks/use-credits";

interface HeaderProps {
  onBackClick?: () => void;
  showProgressBar?: boolean;
  moduleProgress?: Array<{ progress: number }>;
  showNavLinks?: boolean; // Show home/courses links
  courseTitle?: string; // Course title to display in header
}

function Header({ onBackClick, showProgressBar, moduleProgress, showNavLinks, courseTitle }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const { credits } = useCredits();

  // Load saved API key on mount
  useEffect(() => {
    const storedKey = getApiKey();
    setSavedApiKey(storedKey);
  }, []);

  // Refresh saved API key when dialog closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Refresh the saved key status when dialog closes
      const storedKey = getApiKey();
      setSavedApiKey(storedKey);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <img 
              src="/logo.svg" 
              alt="Logo"
              className="h-6 w-auto"
            />
          </Link>
          {onBackClick ? (
            <button
              onClick={onBackClick}
              className="text-neutral-600 hover:text-neutral-900"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          ) : null}
        </div>
        {courseTitle ? (
          <h1 className="text-sm font-medium text-neutral-600 truncate max-w-md px-8">
            {courseTitle}
          </h1>
        ) : (
          <div className="flex items-center gap-6">
            <div className="text-sm text-neutral-600">
              {savedApiKey ? (
                <span className="text-green-600 font-semibold">API Key Configured ✓</span>
              ) : (
                <span className="text-orange-600 font-semibold">No API Key</span>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-semibold text-blue-700">
                {credits} {credits === 1 ? "Credit" : "Credits"}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-10 h-10 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-700 hover:text-neutral-900 transition-colors"
            aria-label="API Key"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {showProgressBar && moduleProgress && (
        <div className="h-2 bg-neutral-100">
          <div className="flex h-full">
            {moduleProgress.map((mod, idx) => (
              <div
                key={idx}
                className="flex-1 bg-neutral-100 relative overflow-hidden"
              >
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${mod.progress}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Key Dialog */}
      <ApiKeyDialog open={isOpen} onOpenChange={handleOpenChange} />
    </div>
  );
}

export { Header };
