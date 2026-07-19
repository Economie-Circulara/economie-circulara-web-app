import type { DeliveryDeclarationStatus } from "./types";

/**
 * Etichete + variante `Badge` pt. statusul declaratiei e-Transport. Nu extindem
 * `STATUS_REGISTRY` din `src/components/status-badge.tsx` (in afara scope-ului
 * Task X5 — vezi docs/plans/task-x5-livrari-etransport.md) — randam badge-ul direct
 * cu `@/components/ui/badge`, in acelasi stil vizual.
 */
export const DECLARATION_STATUS_LABELS: Record<DeliveryDeclarationStatus, string> = {
  not_declared: "Nedeclarat",
  declared: "Declarat",
  failed: "Eroare declarare",
};

export const DECLARATION_STATUS_BADGE_VARIANT: Record<
  DeliveryDeclarationStatus,
  "neutral" | "ok" | "danger"
> = {
  not_declared: "neutral",
  declared: "ok",
  failed: "danger",
};
