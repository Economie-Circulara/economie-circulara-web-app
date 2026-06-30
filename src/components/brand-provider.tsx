import type * as React from "react";

export interface BrandTheme {
  /** Culoare brand (orice valoare CSS valida, ex. oklch(...) sau #hex). */
  brand?: string;
  /** Culoare accent. */
  accent?: string;
}

/**
 * White labeling per organizatie: suprascrie tokenii --brand / --accent in runtime.
 * Toti tokenii semantici (--primary, --ring, ...) deriva din ei, deci se reculoreaza tot.
 */
export function BrandProvider({
  theme,
  children,
}: {
  theme?: BrandTheme;
  children: React.ReactNode;
}) {
  const style: Record<string, string> = {};
  if (theme?.brand) style["--brand"] = theme.brand;
  if (theme?.accent) style["--accent"] = theme.accent;

  return (
    <div className="contents" style={style as React.CSSProperties}>
      {children}
    </div>
  );
}
