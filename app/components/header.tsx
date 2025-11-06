"use client";

import { useState } from "react";
import { Key, ExternalLink, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { useMediaQuery } from "../hooks/use-media-query";

interface HeaderProps {
  onBackClick?: () => void;
  showProgressBar?: boolean;
  moduleProgress?: Array<{ progress: number }>;
}

function Header({ onBackClick, showProgressBar, moduleProgress }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const GridIcon = () => (
    <div className="grid grid-cols-3 gap-0.5 w-4 h-4">
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
      <div className="w-1 h-1 bg-gray-600 rounded-sm"></div>
    </div>
  );

  const ApiKeyForm = ({ className }: { className?: string }) => (
    <div className={className}>
      <div className="space-y-4">
        <div className="text-base text-gray-900">
          Add your <span className="font-semibold underline">Together AI</span> API key
        </div>
        <input
          type="text"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              Visit{" "}
              <a
                href="https://together.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-900"
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
        <div className="flex flex-col gap-2">
          <a
            href="https://together.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            Get your API key
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 pt-2 border-t border-gray-200">
          <Info className="w-4 h-4" />
          <span>Credits left: 0</span>
        </div>
      </div>
    </div>
  );

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
          Credits left: <span className="font-semibold">12</span>
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

      {/* API Key Dialog/Drawer - Responsive */}
      {isDesktop ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-lg">
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-2">
                <GridIcon />
                <DialogTitle className="text-left text-lg font-semibold">Together AI API key</DialogTitle>
              </div>
            </DialogHeader>
            <ApiKeyForm />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="max-w-md mx-auto">
            <DrawerHeader className="pb-4">
              <div className="flex items-center gap-2">
                <GridIcon />
                <DrawerTitle className="text-left">Together AI API key</DrawerTitle>
              </div>
            </DrawerHeader>
            <ApiKeyForm />
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

export { Header };
