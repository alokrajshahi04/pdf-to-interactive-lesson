import type { Metadata } from "next";
import { CoursesClient } from "./courses-client";

export const metadata: Metadata = {
  title: "My Courses",
  description: "View and manage your interactive courses",
  openGraph: {
    title: "My Courses | PDF to Interactive Lesson Generator",
    description: "View and manage your interactive courses",
  },
  twitter: {
    title: "My Courses | PDF to Interactive Lesson Generator",
    description: "View and manage your interactive courses",
  },
};

export default function CoursesPage() {
  return <CoursesClient />;
}

