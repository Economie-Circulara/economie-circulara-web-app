"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Explicatie la cerere: un buton „i” care deschide un panou mic. Nu e un tooltip pe
 * hover - trebuie sa mearga si pe telefon (click/tap) si cu tastatura (Enter/Spatiu,
 * Escape inchide), iar textul poate avea mai multe paragrafe.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** Eticheta accesibila a butonului (ex. „Ce sunt creditele AI?”). */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="size-4" aria-hidden />
      </button>
      {open ? (
        <span
          id={panelId}
          role="note"
          className="absolute top-6 right-0 z-20 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border bg-card p-3 text-xs leading-relaxed text-card-foreground shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
