import type { BadgeVariant } from "@/components/ui/badge";
import type { ItemKind, UnitOfMeasure } from "./types";

export const KIND_LABELS: Record<ItemKind, string> = {
  physical: "Fizic",
  service: "Serviciu",
};

export const KIND_OPTIONS: ItemKind[] = ["physical", "service"];

/**
 * Culoarea badge-ului de tip. Nu folosim `STATUS_REGISTRY`
 * (src/components/status-badge.tsx) — e un registru partajat cu chei fixe pentru
 * alte featuri; itemii au propriul badge, construit direct pe `Badge`.
 */
export const KIND_BADGE_VARIANT: Record<ItemKind, BadgeVariant> = {
  physical: "info",
  service: "accent",
};

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  kg: "kg",
  tona: "tonă",
  mc: "mc",
  litru: "litru",
  bucata: "bucată",
  sac: "sac",
  palet: "palet",
};

export const UNIT_OPTIONS: UnitOfMeasure[] = [
  "kg",
  "tona",
  "mc",
  "litru",
  "bucata",
  "sac",
  "palet",
];
