"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Forma unui logo: `wide` = varianta orizontala (simbol + nume pe un rand), care
 * contine deja numele firmei; `compact` = simbol / varianta patrata (nume dedesubt
 * sau deloc), langa care afisam si numele scris.
 */
export type LogoShape = "wide" | "compact";

/** Raportul latime/inaltime de la care un logo e tratat ca orizontal. */
export const WIDE_LOGO_MIN_RATIO = 2;

export function logoShapeFromSize(width: number, height: number): LogoShape {
  return height > 0 && width / height >= WIDE_LOGO_MIN_RATIO ? "wide" : "compact";
}

export type OrgBrandVariant = "sidebar" | "header" | "login";

const VARIANT_CLASSES: Record<
  OrgBrandVariant,
  { root: string; wide: string; compact: string; name: string }
> = {
  sidebar: {
    root: "flex min-w-0 items-center gap-2.5",
    wide: "h-auto max-h-14 w-auto max-w-full",
    compact: "size-12 shrink-0 object-contain",
    name: "truncate font-semibold",
  },
  header: {
    root: "flex min-w-0 items-center gap-3",
    wide: "h-auto max-h-12 w-auto max-w-[min(20rem,60vw)] sm:max-h-14",
    compact: "size-12 shrink-0 object-contain sm:size-14",
    name: "truncate text-lg font-semibold tracking-tight",
  },
  login: {
    root: "flex flex-col items-center gap-3",
    wide: "h-auto max-h-28 w-auto max-w-full",
    compact: "size-28 object-contain",
    name: "text-2xl font-semibold tracking-tight",
  },
};

export interface OrgBrandProps {
  name: string;
  logoUrl?: string | null;
  variant: OrgBrandVariant;
  /** Elementul pentru nume (ex. `h1` pe login). */
  nameAs?: "span" | "h1";
  /** Continut afisat in locul logo-ului cand organizatia nu are unul (ex. initiale). */
  fallback?: React.ReactNode;
}

/**
 * Identitatea vizuala a organizatiei: logo adaptat la forma lui + numele.
 * Un logo orizontal contine deja numele, deci numele ramane doar pentru cititoare
 * de ecran (sr-only); un logo compact / lipsa logo-ului afiseaza numele scris.
 * Forma se afla dupa incarcarea imaginii (dimensiunile naturale) - pana atunci
 * imaginea e tratata ca orizontala.
 */
export function OrgBrand({ name, logoUrl, variant, nameAs = "span", fallback }: OrgBrandProps) {
  const classes = VARIANT_CLASSES[variant];
  const imgRef = useRef<HTMLImageElement>(null);
  const [shape, setShape] = useState<LogoShape | null>(null);

  // Imaginea poate fi deja incarcata (cache) inainte de hidratare, cand `onLoad`
  // nu mai ajunge la React - citim dimensiunile direct.
  useEffect(() => {
    const img = imgRef.current;
    setShape(
      img?.complete && img.naturalWidth
        ? logoShapeFromSize(img.naturalWidth, img.naturalHeight)
        : null,
    );
  }, [logoUrl]);

  const NameTag = nameAs;
  const showName = !logoUrl || shape === "compact";

  return (
    <div className={classes.root}>
      {logoUrl ? (
        // Logo-ul vine din Supabase Storage (domenii variabile per proiect) - <img>
        // simplu, fara next/image. `org-logo` = fundal alb, lizibil si pe fundal inchis.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={logoUrl}
          // Numele e mereu in text (vizibil sau sr-only) - imaginea e decorativa.
          alt=""
          data-shape={shape ?? "wide"}
          onLoad={(e) =>
            setShape(logoShapeFromSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))
          }
          className={cn("org-logo", shape === "compact" ? classes.compact : classes.wide)}
        />
      ) : (
        fallback
      )}
      <NameTag className={showName ? classes.name : "sr-only"}>{name}</NameTag>
    </div>
  );
}
