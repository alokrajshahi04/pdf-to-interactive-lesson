"use client";

import { CreditsProvider } from "../hooks/use-credits";

export function CreditsProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CreditsProvider>{children}</CreditsProvider>;
}

