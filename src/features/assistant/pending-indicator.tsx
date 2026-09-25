"use client";

import { useEffect, useState } from "react";

/**
 * Indicatorul „lucrez” din chat. O tura poate face mai multe runde de model (caut
 * clientul -> caut produsele -> pregatesc actiunea), iar raspunsul nu e streamed -
 * fara feedback, cererile lungi pareau blocate. Textul se schimba dupa timpul scurs,
 * cu secundele afisate, ca utilizatorul sa vada ca se lucreaza.
 */
export function pendingLabel(seconds: number): string {
  if (seconds < 5) return "Mă gândesc...";
  if (seconds < 15) return `Caut datele necesare... (${seconds} s)`;
  return `Lucrez la o cerere cu mai mulți pași, mai durează puțin... (${seconds} s)`;
}

export function PendingIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
      {pendingLabel(seconds)}
    </p>
  );
}
