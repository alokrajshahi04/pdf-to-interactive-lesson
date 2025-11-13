"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
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
import { getApiKey, saveApiKey, removeApiKey } from "@/lib/api-key-storage";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved API key on mount and when dialog opens
  useEffect(() => {
    if (open) {
      const storedKey = getApiKey();
      setSavedApiKey(storedKey);
      if (storedKey) {
        setApiKey(storedKey);
      } else {
        setApiKey("");
      }
      // Auto-focus the input when dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      saveApiKey(apiKey.trim());
      setSavedApiKey(apiKey.trim());
      onOpenChange(false);
    }
  };

  const handleRemoveApiKey = () => {
    removeApiKey();
    setSavedApiKey(null);
    setApiKey("");
  };

  const GridIcon = () => (
    <div className="grid grid-cols-3 gap-0.5 w-4 h-4">
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-neutral-600 rounded-sm"></div>
    </div>
  );

  const ApiKeyForm = ({ className }: { className?: string }) => (
    <div className={className}>
      <div className="space-y-4">
        <div className="text-base text-neutral-900">
          {savedApiKey ? "Update" : "Add"} your{" "}
          <span className="font-semibold underline">Together AI</span> API key
        </div>
        <input
          ref={inputRef}
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && apiKey.trim()) {
              e.preventDefault();
              handleSaveApiKey();
            }
          }}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
        />
        <ul className="space-y-2 text-sm text-neutral-600">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              Visit{" "}
              <a
                href="https://together.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-900"
              >
                together.ai
              </a>{" "}
              and sign up for free
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Copy your API key and paste it above</span>
          </li>
        </ul>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSaveApiKey}
            disabled={!apiKey.trim()}
            className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savedApiKey ? "Update API Key" : "Save API Key"}
          </button>
          <div className="flex items-center justify-between text-sm pt-2 gap-6">
            <a
              href="https://together.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 hover:text-neutral-900 underline flex items-center gap-1"
            >
              Get your API key
              <ExternalLink className="w-3 h-3" />
            </a>
            {savedApiKey && (
              <button
                onClick={handleRemoveApiKey}
                className="text-red-600 hover:text-red-700 underline text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-white rounded-lg">
          <DialogHeader className="pb-4">
            <div className="flex items-center gap-2">
              <GridIcon />
              <DialogTitle className="text-left text-lg font-semibold text-neutral-900">
                Together AI API key
              </DialogTitle>
            </div>
          </DialogHeader>
          <ApiKeyForm />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader className="pb-4">
          <div className="flex items-center gap-2">
            <GridIcon />
            <DrawerTitle className="text-left text-neutral-900">Together AI API key</DrawerTitle>
          </div>
        </DrawerHeader>
        <ApiKeyForm />
      </DrawerContent>
    </Drawer>
  );
}

