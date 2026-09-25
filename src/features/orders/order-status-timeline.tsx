"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_STATUS } from "./labels";
import type { OrderStatus } from "./types";

/** Traseul normal al unei comenzi (fara `cancelled`, care e o iesire, nu un pas). */
const JOURNEY: readonly OrderStatus[] = ["draft", "sent", "accepted", "delivered", "closed"];

/**
 * Traseul comenzilor care intra in stoc in loc sa iasa (aport - migrarea 0030, si
 * retur/garanție - migrarea 0010): `draft -> accepted`, prin RPC-ul dedicat. Nu
 * trec prin sent/delivered/closed - nu se livreaza nimic catre client.
 */
export const INTAKE_JOURNEY: readonly OrderStatus[] = ["draft", "accepted"];

/**
 * Traseul unui aport: ca `INTAKE_JOURNEY`, dar cu pasul `sent` - aportul trimis din
 * portalul clientului asteapta aprobarea in `sent` (migrarea 0042). Un aport creat
 * de staff sare direct `draft -> accepted` (pasul `sent` ramane doar neatins).
 */
export const APORT_JOURNEY: readonly OrderStatus[] = ["draft", "sent", "accepted"];

/**
 * Explicatii RO in limbaj simplu pentru fiecare status - afisate la hover (desktop,
 * `title`) SI la tap (mobil, expandare inline sub stepper - vezi comentariul
 * componentei mai jos).
 */
const STATUS_EXPLANATIONS: Record<OrderStatus, string> = {
  draft: "Comanda e în lucru, poate fi editată sau anulată.",
  sent: "Trimisă spre confirmare internă — nu înseamnă că a fost livrată.",
  accepted: "Comanda a fost confirmată, stocul necesar a fost rezervat.",
  delivered: "Marfa/abonamentul a ajuns la client.",
  closed: "Comanda e închisă, certificatul a fost generat.",
  cancelled: "Comanda a fost anulată, stocul rezervat a fost refăcut.",
};

/**
 * Stepper orizontal cu cele 6 statusuri posibile ale unei comenzi (Task de
 * explicatie a statusurilor), evidentiind statusul curent. Fiecare pas e un buton
 * cu `title` (tooltip nativ la hover, pe desktop) care, la click/tap, extinde
 * dedesubt textul explicativ (codebase-ul nu are inca un primitiv de
 * tooltip/popover - vezi `src/components/ui/` - am preferat aceasta varianta
 * simpla in loc sa adaug o dependinta noua doar pentru acest task).
 *
 * O comanda `cancelled` a iesit din traseul normal draft->closed - randam
 * traseul normal estompat + un pas final "Anulată" evidentiat, in loc sa
 * pretindem ca stim din ce status exact a fost anulata (schema 0001 nu retine un
 * istoric de tranzitii, vezi comentariul din comenzi/[id]/page.tsx).
 */
export function OrderStatusTimeline({
  status,
  journey = JOURNEY,
}: {
  status: OrderStatus;
  /** Traseul de afisat - implicit cel de vanzare; foloseste `INTAKE_JOURNEY` pt. aport/retur. */
  journey?: readonly OrderStatus[];
}) {
  const [expanded, setExpanded] = useState<OrderStatus | null>(null);
  const isCancelled = status === "cancelled";
  const currentIndex = journey.indexOf(status as (typeof journey)[number]);
  const steps: readonly OrderStatus[] = isCancelled ? [...journey, "cancelled"] : journey;

  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => {
          const reached = isCancelled ? step === "cancelled" : index <= currentIndex;
          return (
            <li key={step} className="flex items-center gap-2">
              {index > 0 ? <span className="text-muted-foreground">{"->"}</span> : null}
              <button
                type="button"
                title={STATUS_EXPLANATIONS[step]}
                aria-expanded={expanded === step}
                onClick={() => setExpanded((prev) => (prev === step ? null : step))}
                className={cn(
                  "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  reached ? "" : "opacity-40",
                )}
              >
                <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[step]} />
              </button>
            </li>
          );
        })}
      </ol>
      {expanded ? (
        <p className="text-xs text-muted-foreground">{STATUS_EXPLANATIONS[expanded]}</p>
      ) : null}
    </div>
  );
}
