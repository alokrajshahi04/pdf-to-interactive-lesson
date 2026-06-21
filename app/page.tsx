import type { Metadata } from "next";
import { ogImage, twitterImage } from "./seo";
import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  title: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
  description:
    "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
  openGraph: {
    title: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
    description:
      "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
    images: [ogImage],
  },
  twitter: {
    title: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
    description:
      "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
    images: [twitterImage],
  },
  alternates: {
    canonical: "https://lesson.tolti.app",
  },
};

export default function Home() {
  return <HomeClient />;
}
