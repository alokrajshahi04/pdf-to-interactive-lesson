import type { Metadata } from "next";
import { ogImage, twitterImage } from "../../seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  
  // Note: Course data is stored in localStorage (client-side only),
  // so we can't access the actual course title server-side.
  // The client component will update the title dynamically.
  // This provides good defaults for SEO.
  
  return {
    title: "Course",
    description: "Interactive course lesson",
    openGraph: {
      title: "Course | PDF to Interactive Lesson Generator",
      description: "Interactive course lesson",
      images: [ogImage],
    },
    twitter: {
      title: "Course | PDF to Interactive Lesson Generator",
      description: "Interactive course lesson",
      images: [twitterImage],
    },
  };
}

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
