import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { GeneratingPageContent } from "./generating-client";

export const metadata: Metadata = {
  title: "Generating Course",
  description: "Your interactive course is being generated...",
  openGraph: {
    title: "Generating Course | PDF to Interactive Lesson Generator",
    description: "Your interactive course is being generated...",
  },
  twitter: {
    title: "Generating Course | PDF to Interactive Lesson Generator",
    description: "Your interactive course is being generated...",
  },
};


export default function GeneratingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader size={48} className="text-blue-500" />
      </div>
    }>
      <GeneratingPageContent />
    </Suspense>
  );
}

