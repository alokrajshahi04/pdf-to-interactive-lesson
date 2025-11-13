import type { Metadata } from "next";

type Props = {
  params: { slug: string; moduleIndex: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, moduleIndex } = params;
  
  // Note: Course and module data is stored in localStorage (client-side only),
  // so we can't access the actual course/module titles server-side.
  // The client component will update the title dynamically.
  // This provides good defaults for SEO.
  
  return {
    title: `Module ${parseInt(moduleIndex) + 1}`,
    description: "Interactive course lesson",
    openGraph: {
      title: `Module ${parseInt(moduleIndex) + 1} | PDF to Interactive Lesson Generator`,
      description: "Interactive course lesson",
    },
    twitter: {
      title: `Module ${parseInt(moduleIndex) + 1} | PDF to Interactive Lesson Generator`,
      description: "Interactive course lesson",
    },
  };
}

export default function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

