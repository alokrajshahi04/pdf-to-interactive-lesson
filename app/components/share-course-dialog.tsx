"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
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
}

export function ShareCourseDialog({
  open,
  onOpenChange,
  courseTitle,
  courseSlug,
}: ShareCourseDialogProps) {
  const [copied, setCopied] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate the shareable link
  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/course/${courseSlug}`
      : "";

  // Reset copied state when dialog opens
  useEffect(() => {
    if (open) {
      setCopied(false);
      // Auto-focus the input when dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
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

  const ShareForm = ({ className }: { className?: string }) => (
    <div className={className}>
      <div className="space-y-4">
        <div className="text-base text-neutral-900">
          Share <span className="font-semibold">{courseTitle}</span> with others
        </div>
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
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 min-w-[100px]"
            >
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
            </button>
          </div>
        </div>
        <p className="text-sm text-neutral-600">
          Anyone with this link can access and view your course.
        </p>
        <button
          onClick={() => onOpenChange(false)}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-900"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-white rounded-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-left text-lg font-semibold text-neutral-900">
              Share Course
            </DialogTitle>
          </DialogHeader>
          <ShareForm />
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
        <ShareForm />
      </DrawerContent>
    </Drawer>
  );
}

