import type { RecipeComponent } from "@/features/recipes/types";

/**
 * O linie distribuita pro-rata dupa procentul unei componente de rețetă.
 * Reprezinta atat "consumul calculat" (4a: cate din fiecare componenta trebuie
 * consumate ca sa obtii cantitatea de output dorita), cat si "outputul ideal"
 * (4b: in ce fractii se descompune, teoretic, cantitatea de input consumata) —
 * matematic e aceeasi operatie (procent × total), doar directia semantica difera
 * (vezi comentariul din migrarea 0008 despre reteta interpretata bidirectional).
 */
export interface DistributedLine {
  itemId: string;
  itemTitle: string;
  unit: RecipeComponent["unit"];
  percentage: number;
  qty: number;
}

/** Rotunjire la 3 zecimale — precizia coloanelor `numeric(14,3)` din schema. */
export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Distribuie `totalQty` pe componentele unei rețete, proportional cu procentul
 * fiecareia (`qty = totalQty * percentage / 100`). Folosita atat pentru 4a
 * (consum calculat pe componente) cat si pentru 4b (output ideal pe fractii).
 */
export function distributeByPercentage(
  components: RecipeComponent[],
  totalQty: number,
): DistributedLine[] {
  if (!Number.isFinite(totalQty) || totalQty <= 0) {
    throw new Error("Cantitatea trebuie sa fie mai mare ca zero.");
  }
  return components.map((component) => ({
    itemId: component.componentItemId,
    itemTitle: component.componentItemTitle,
    unit: component.unit,
    percentage: component.percentage,
    qty: roundQty(totalQty * (component.percentage / 100)),
  }));
}

/** 4a — cantitatea de consumat din fiecare componenta, pentru output-ul dorit. */
export const computeRequiredConsumption = distributeByPercentage;

/** 4b — outputul ideal (fractii), conform "rețetei" materialului de input. */
export const computeIdealOutput = distributeByPercentage;

/** Suma cantitatilor dintr-o lista de linii (input sau output). */
export function sumQty(lines: { qty: number }[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.qty, 0));
}

/**
 * Randament/pierderi — diferenta intre masa totala de input si cea de output
 * (informativ; se INREGISTREAZA, nu se VALIDEAZA — AGENTS.md §4). Pozitiv =
 * pierdere (output < input, normal la reciclare/recondiționare); negativ ar
 * insemna output > input (posibil doar daca unitatile difera intre componente —
 * afisat ca atare, fara blocare).
 */
export function computeLoss(totalInputQty: number, totalOutputQty: number): number {
  return roundQty(totalInputQty - totalOutputQty);
}
