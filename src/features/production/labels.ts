import type { ProcessStatus, ProcessType, ProductionKind } from "./types";

export const PROCESS_TYPE_LABELS: Record<ProcessType, string> = {
  output_fixed: "Output fix (fabricație)",
  input_fixed: "Input fix / output variabil (reciclare)",
};

export const PRODUCTION_KIND_LABELS: Record<ProductionKind, string> = {
  productie: "Producție",
  reciclare: "Reciclare",
  reconditionare: "Recondiționare",
};

export const PRODUCTION_KIND_OPTIONS: ProductionKind[] = [
  "productie",
  "reciclare",
  "reconditionare",
];

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  planned: "Planificat",
  in_progress: "În lucru",
  awaiting_confirmation: "Așteaptă confirmare",
  completed: "Finalizat",
  cancelled: "Anulat",
};

/**
 * Cheia din `STATUS_REGISTRY.process` (src/components/status-badge.tsx) pentru
 * fiecare valoare din enum-ul DB `process_status`. Registrul e definit deja (din
 * T0.2) cu exact aceste chei — nu se modifica din acest task.
 */
export const PROCESS_STATUS_BADGE_STATUS: Record<ProcessStatus, string> = {
  planned: "planificat",
  in_progress: "in_lucru",
  awaiting_confirmation: "asteapta_confirmare",
  completed: "finalizat",
  cancelled: "anulat",
};
