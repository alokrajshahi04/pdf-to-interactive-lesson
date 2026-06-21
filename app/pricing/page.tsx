import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the perfect plan for your PDF to interactive lesson needs",
  openGraph: {
    title: "Pricing | PDF to Interactive Lesson Generator",
    description: "Choose the perfect plan for your PDF to interactive lesson needs",
  },
  twitter: {
    title: "Pricing | PDF to Interactive Lesson Generator",
    description: "Choose the perfect plan for your PDF to interactive lesson needs",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
