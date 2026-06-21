import type { Metadata } from "next";
import { DashboardWrapper } from "./dashboard-wrapper";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your courses, credits, and account settings",
  openGraph: {
    title: "Dashboard | PDF to Interactive Lesson Generator",
    description: "Manage your courses, credits, and account settings",
  },
  twitter: {
    title: "Dashboard | PDF to Interactive Lesson Generator",
    description: "Manage your courses, credits, and account settings",
  },
};

export default function DashboardPage() {
  return <DashboardWrapper />;
}
