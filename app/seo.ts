const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pdf-to-interactive-lesson.vercel.app";

export const metadataBase = new URL(appUrl);

export const ogImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Turn any PDF into a Lesson - AI slices your document into 5-minute lessons with hands-on questions.",
};

export const twitterImage = ogImage.url;
