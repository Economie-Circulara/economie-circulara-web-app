import { Badge, type BadgeVariant } from "@/components/ui/badge";

type StatusDef = { label: string; variant: BadgeVariant };

/**
 * Registru de statusuri si culorile lor, extras din mockup
 * (docs/design/Lateris_Trace.dc.html). Etichetele sunt in romana.
 */
export const STATUS_REGISTRY = {
  // Statusuri comanda: draft → trimisa → acceptata → livrata → inchisa / anulata
  order: {
    draft: { label: "Draft", variant: "neutral" },
    trimisa: { label: "Trimisă", variant: "info" },
    acceptata: { label: "Acceptată", variant: "warn" },
    livrata: { label: "Livrată", variant: "ok" },
    inchisa: { label: "Închisă", variant: "neutral" },
    anulata: { label: "Anulată", variant: "danger" },
  },
  // Provenienta lot la intrarea in stoc
  provenance: {
    achizitie: { label: "Achiziție", variant: "info" },
    productie: { label: "Producție", variant: "accent" },
    reciclare: { label: "Reciclare", variant: "ok" },
    retur: { label: "Retur", variant: "warn" },
    ajustare: { label: "Ajustare", variant: "neutral" },
  },
  // Status lot in stoc
  lot: {
    activ: { label: "Activ", variant: "ok" },
    blocat: { label: "Blocat", variant: "danger" },
  },
  // Statusuri proces: planificat → in lucru → asteapta confirmare → finalizat / anulat
  process: {
    planificat: { label: "Planificat", variant: "neutral" },
    in_lucru: { label: "În lucru", variant: "info" },
    asteapta_confirmare: { label: "Așteaptă confirmare", variant: "warn" },
    finalizat: { label: "Finalizat", variant: "ok" },
    anulat: { label: "Anulat", variant: "danger" },
  },
} as const satisfies Record<string, Record<string, StatusDef>>;

export type StatusGroup = keyof typeof STATUS_REGISTRY;

export function resolveStatus(group: StatusGroup, status: string): StatusDef {
  const groupMap = STATUS_REGISTRY[group] as Record<string, StatusDef>;
  return groupMap[status] ?? { label: status, variant: "neutral" };
}

export interface StatusBadgeProps {
  group: StatusGroup;
  status: string;
  className?: string;
}

export function StatusBadge({ group, status, className }: StatusBadgeProps) {
  const { label, variant } = resolveStatus(group, status);
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
