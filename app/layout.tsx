import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Fustat } from "next/font/google";
import { metadataBase, ogImage, twitterImage } from "./seo";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const fustat = Fustat({
  variable: "--font-fustat",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "PDF to Interactive Lesson Generator",
    template: "%s | PDF to Interactive Lesson Generator",
  },
  description: "Convert PDFs into interactive course lessons with AI-powered content generation",
  keywords: ["PDF", "interactive lessons", "course generator", "AI", "education", "learning"],
  authors: [{ name: "PDF to Interactive Lesson Generator" }],
  openGraph: {
    title: "PDF to Interactive Lesson Generator",
    description: "Convert PDFs into interactive course lessons with AI-powered content generation",
    type: "website",
    siteName: "PDF to Interactive Lesson Generator",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF to Interactive Lesson Generator",
    description: "Convert PDFs into interactive course lessons with AI-powered content generation",
    images: [twitterImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fustat.variable} antialiased bg-white`}
      >
        {children}
      </body>
    </html>
  );
}
