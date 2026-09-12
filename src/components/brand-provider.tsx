import type * as React from "react";

export interface BrandTheme {
  /** Culoare brand (orice valoare CSS valida, ex. oklch(...) sau #hex). */
  brand?: string;
  /** Culoare accent. */
  accent?: string;
}

/**
 * White labeling per organizatie: suprascrie tokenii --brand / --accent in runtime.
 *
 * --primary si --ring sunt declarati o singura data in globals.css, la nivel de :root,
 * ca `var(--brand)`. Valoarea calculata a unei proprietati CSS custom se fixeaza pe
 * elementul unde e declarata (aici :root), asa ca suprascrierea lui --brand pe un div
 * descendent nu se propaga inapoi la --primary/--ring (ele raman "inghetate" la
 * valoarea din :root). De aceea trebuie suprascrise explicit si tokenii derivati.
 */
export function BrandProvider({
  theme,
  children,
}: {
  theme?: BrandTheme;
  children: React.ReactNode;
}) {
  const style: Record<string, string> = {};
  if (theme?.brand) {
    style["--brand"] = theme.brand;
    style["--primary"] = theme.brand;
    style["--ring"] = theme.brand;
  }
  if (theme?.accent) style["--accent"] = theme.accent;

  return (
    <div className="contents" style={style as React.CSSProperties}>
      {children}
    </div>
  );
}
