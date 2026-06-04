"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check, Globe2, Lock } from "lucide-react";
import { getOrCreateUserId } from "@/lib/utils/session";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { useMediaQuery } from "../hooks/use-media-query";

interface ShareCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  courseSlug: string;
  isPublic: boolean;
  isOwner: boolean;
  onVisibilityChange: (isPublic: boolean) => void;
}

interface ShareFormProps {
  className?: string;
  courseTitle: string;
  shareLink: string;
  isPublic: boolean;
  isOwner: boolean;
  copied: boolean;
  isUpdating: boolean;
  visibilityError: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCopyLink: () => void;
  onSetPublic: () => void;
  onSetPrivate: () => void;
  onClose: () => void;
}

// Move component outside to avoid creating it during render
const ShareForm = ({
  className,
  courseTitle,
  shareLink,
  isPublic,
  isOwner,
  copied,
  isUpdating,
  visibilityError,
  inputRef,
  onCopyLink,
  onSetPublic,
  onSetPrivate,
  onClose,
}: ShareFormProps) => (
  <div className={className}>
    <div className="space-y-4">
      <div className="text-base text-neutral-900">
        Share <span className="font-semibold">{courseTitle}</span>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-4">
        {isPublic ? (
          <Globe2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-700" />
        ) : (
          <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-700" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-900">
            {isPublic ? "Public link sharing" : "Private course"}
          </p>
          <p className="text-sm text-neutral-600">
            {isPublic
              ? "Anyone with this link can view this course."
              : isOwner
                ? "Only this browser session can open this course."
                : "The owner has not shared this course publicly."}
          </p>
        </div>
      </div>

      {visibilityError && (
        <p className="rounded-lg border border-incorrect-border bg-incorrect-bg px-3 py-2 text-sm text-incorrect-fg">
          {visibilityError}
        </p>
      )}

      {isPublic && (
        <div className="space-y-2">
          <label className="text-sm text-neutral-600">Course link</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <Button shape="lg" onClick={onCopyLink} className="min-w-[100px]">
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {isOwner && (
          isPublic ? (
            <Button
              variant="secondary"
              shape="lg"
              onClick={onSetPrivate}
              disabled={isUpdating}
            >
              <Lock className="h-4 w-4" />
              {isUpdating ? "Updating..." : "Make private"}
            </Button>
          ) : (
            <Button
              shape="lg"
              onClick={onSetPublic}
              disabled={isUpdating}
            >
              <Globe2 className="h-4 w-4" />
              {isUpdating ? "Updating..." : "Share publicly"}
            </Button>
          )
        )}
        <Button variant="secondary" shape="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  </div>
);

export function ShareCourseDialog({
  open,
  onOpenChange,
  courseTitle,
  courseSlug,
  isPublic,
  isOwner,
  onVisibilityChange,
}: ShareCourseDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const inputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(open);

  // Generate the shareable link
  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/course/${courseSlug}`
      : "";

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCopied(false);
      setVisibilityError(null);
      const focusTimeout = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
      prevOpenRef.current = open;
      return () => clearTimeout(focusTimeout);
    }
    prevOpenRef.current = open;
  }, [open]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const updateVisibility = async (nextIsPublic: boolean) => {
    setIsUpdating(true);
    setVisibilityError(null);

    try {
      const response = await fetch(`/api/courses/${courseSlug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": getOrCreateUserId(),
        },
        body: JSON.stringify({ isPublic: nextIsPublic }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update sharing");
      }

      const updated = await response.json();
      onVisibilityChange(updated.isPublic === true);
      setCopied(false);
    } catch (err) {
      setVisibilityError(
        err instanceof Error ? err.message : "Failed to update sharing"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-white rounded-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-left text-lg font-semibold text-neutral-900">
              Share Course
            </DialogTitle>
          </DialogHeader>
          <ShareForm
            courseTitle={courseTitle}
            shareLink={shareLink}
            isPublic={isPublic}
            isOwner={isOwner}
            copied={copied}
            isUpdating={isUpdating}
            visibilityError={visibilityError}
            inputRef={inputRef}
            onCopyLink={handleCopyLink}
            onSetPublic={() => updateVisibility(true)}
            onSetPrivate={() => updateVisibility(false)}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader className="pb-4">
          <DrawerTitle className="text-left text-neutral-900">
            Share Course
          </DrawerTitle>
        </DrawerHeader>
        <ShareForm
          courseTitle={courseTitle}
          shareLink={shareLink}
          isPublic={isPublic}
          isOwner={isOwner}
          copied={copied}
          isUpdating={isUpdating}
          visibilityError={visibilityError}
          inputRef={inputRef}
          onCopyLink={handleCopyLink}
          onSetPublic={() => updateVisibility(true)}
          onSetPrivate={() => updateVisibility(false)}
          onClose={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
