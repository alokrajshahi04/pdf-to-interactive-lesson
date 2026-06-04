import type { Metadata } from "next";
import { ogImage, twitterImage } from "./seo";
import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  title: "PDF to Interactive Lesson Generator",
  description: "Upload a PDF and transform it into an interactive learning experience",
  openGraph: {
    title: "PDF to Interactive Lesson Generator",
    description: "Upload a PDF and transform it into an interactive learning experience",
    images: [ogImage],
  },
  twitter: {
    title: "PDF to Interactive Lesson Generator",
    description: "Upload a PDF and transform it into an interactive learning experience",
    images: [twitterImage],
  },
};

export default function Home() {
  return <HomeClient />;
}
