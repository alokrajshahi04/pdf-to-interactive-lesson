"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface CreditsContextType {
  credits: number;
  updateCredits: (remaining: number) => void;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<number>(12); // Default to 12 credits

  // Load credits from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("user_credits");
    if (stored) {
      try {
        setCredits(parseInt(stored, 10));
      } catch {
        // Invalid stored value, use default
      }
    }
  }, []);

  // Save credits to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("user_credits", credits.toString());
  }, [credits]);

  const updateCredits = (remaining: number) => {
    setCredits(remaining);
  };

  const refreshCredits = async () => {
    // Could fetch from server if we add a credits endpoint
    // For now, just keep using localStorage
  };

  return (
    <CreditsContext.Provider value={{ credits, updateCredits, refreshCredits }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error("useCredits must be used within a CreditsProvider");
  }
  return context;
}

