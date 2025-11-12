"use client";

import { useState, useEffect } from "react";
import { Key } from "lucide-react";
import { getApiKey } from "@/lib/api-key-storage";
import { ApiKeyDialog } from "./api-key-dialog";

interface HeaderProps {
  onBackClick?: () => void;
  showProgressBar?: boolean;
  moduleProgress?: Array<{ progress: number }>;
}

function Header({ onBackClick, showProgressBar, moduleProgress }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);

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
    <div className="border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBackClick}
          className="text-gray-600 hover:text-gray-900"
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
        <div className="text-sm text-gray-600">
          {savedApiKey ? (
            <span className="text-green-600 font-semibold">API Key Configured ✓</span>
          ) : (
            <span className="text-orange-600 font-semibold">No API Key</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Key className="w-6 h-6" />
          </button>
          <button className="text-gray-600 hover:text-gray-900">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <button className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center">
            i
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {showProgressBar && moduleProgress && (
        <div className="h-2 bg-gray-100">
          <div className="flex h-full">
            {moduleProgress.map((mod, idx) => (
              <div
                key={idx}
                className="flex-1 bg-gray-100 relative overflow-hidden"
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
