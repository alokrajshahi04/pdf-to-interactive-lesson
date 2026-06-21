import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Fustat } from "next/font/google";
import { metadataBase, ogImage, twitterImage } from "./seo";
import "./globals.css";
import PlausibleProvider from "next-plausible";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "./components/navbar";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
    template: "%s | PDF to Interactive Lesson",
  },
  description:
    "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
  keywords: [
    "PDF",
    "interactive lessons",
    "course generator",
    "AI",
    "education",
    "learning",
    "Together AI",
  ],
  authors: [{ name: "PDF to Interactive Lesson" }],
  openGraph: {
    title: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
    description:
      "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
    type: "website",
    siteName: "PDF to Interactive Lesson",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF to Interactive Lesson | Turn PDFs into AI Courses",
    description:
      "Upload any PDF and transform it into a personalized, interactive AI course with quizzes, lessons, and progress tracking.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            })();`,
          }}
        />
        <PlausibleProvider domain="lesson.tolti.app" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fustat.variable} antialiased bg-white dark:bg-neutral-950 transition-colors duration-300`}
      >
        <ClerkProvider>
          <Navbar />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
