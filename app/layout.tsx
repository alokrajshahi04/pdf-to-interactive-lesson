import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Fustat } from "next/font/google";
import "./globals.css";
import { CreditsProviderWrapper } from "./components/credits-provider-wrapper";

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

export const metadata: Metadata = {
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
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "PDF to Interactive Lesson Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF to Interactive Lesson Generator",
    description: "Convert PDFs into interactive course lessons with AI-powered content generation",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fustat.variable} antialiased`}
      >
        <CreditsProviderWrapper>{children}</CreditsProviderWrapper>
      </body>
    </html>
  );
}
