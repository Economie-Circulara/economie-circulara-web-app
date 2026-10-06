"use client";

import { useEffect, useState } from "react";
import type { SiteHeroImage } from "@/lib/content";

const INTERVAL_MS = 4500;

/**
 * Fundalul foto al hero-ului: fotografiile se succed lent, prin estompare. Fara sageti
 * sau buline - doar un buton de pauza. Cu `prefers-reduced-motion` ramane prima poza.
 */
export function HeroSlideshow({ images }: { images: SiteHeroImage[] }) {
  // Numarul de schimbari: pozitia curenta e restul impartirii la numarul de poze.
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = step % images.length;

  useEffect(() => {
    if (paused || images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      // Tabul din fundal nu consuma pozele.
      if (!document.hidden) setStep((s) => s + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, images.length]);

  return (
    <>
      <div className="hero-media">
        {images.map((img, i) =>
          // Se descarca doar poza curenta si urmatoarea, nu toate la incarcarea paginii.
          i <= step + 1 ? (
            // Site static fara optimizator de imagini.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.src}
              src={img.src}
              alt={img.alt}
              aria-hidden={i !== active}
              className={i === active ? "is-active" : undefined}
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
            />
          ) : null,
        )}
      </div>
      {images.length > 1 && (
        <button
          type="button"
          className="hero-pause"
          aria-pressed={paused}
          aria-label={
            paused ? "Pornește derularea fotografiilor" : "Oprește derularea fotografiilor"
          }
          onClick={() => setPaused((p) => !p)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            {paused ? (
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            ) : (
              <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor" />
            )}
          </svg>
        </button>
      )}
    </>
  );
}
