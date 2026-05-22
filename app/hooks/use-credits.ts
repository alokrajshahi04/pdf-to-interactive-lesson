import { useState, useEffect } from "react";

interface Credits {
  coursesRemaining: number;
  gradingsRemaining: number;
}

export function useCredits() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchCredits = () => {
      fetch("/api/rate-limit-status")
        .then((res) => res.json())
        .then((data) => {
          if (data.courseLimit != null) {
            setCredits({
              coursesRemaining: data.courseLimit - data.coursesCreated,
              gradingsRemaining: data.gradingLimit - data.gradingsUsed,
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    };

    fetchCredits();
    window.addEventListener("credits-updated", fetchCredits);
    return () => window.removeEventListener("credits-updated", fetchCredits);
  }, []);

  return { credits, loaded };
}
