import type { RecipeComponent } from "@/features/recipes/types";

/**
 * O linie distribuita pro-rata dupa procentul unei componente de rețetă.
 * Reprezinta atat "consumul calculat" (4a: cate din fiecare componenta trebuie
 * consumate ca sa obtii cantitatea de output dorita), cat si "outputul ideal"
 * (4b: in ce fractii se descompune, teoretic, cantitatea de input consumata) -
 * matematic e aceeasi operatie, doar directia semantica difera. Directia e acum
 * EXPLICITA pe reteta (`recipes.direction`, migrarea 0028) si decide care parte e
 * "totalul" care se distribuie si cum se deseneaza fluxul, NU matematica.
 */
export interface DistributedLine {
  itemId: string;
  itemTitle: string;
  /** UM-ul PROPRIU al componentei - `qty` e exprimata in aceasta unitate. */
  unit: RecipeComponent["unit"];
  percentage: number;
  conversionFactor: number;
  /** Cantitatea in UM-ul componentei (dupa conversie) - ce se consuma/produce efectiv. */
  qty: number;
  /**
   * ACEEASI cantitate, exprimata in UM-ul itemului retetei (inainte de impartirea
   * la factor). Doar valorile astea sunt comparabile intre componente cu UM-uri
   * diferite - vezi `sumQtyInRecipeUnit`/`computeLoss`.
   */
  qtyInRecipeUnit: number;
  /** `items.is_tracked` - componentele netrasate nu se consuma/produc din stoc (0029). */
  isTracked: boolean;
}

/** Rotunjire la 3 zecimale - precizia coloanelor `numeric(14,3)` din schema. */
export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Distribuie `totalQty` (exprimata in UM-ul itemului retetei) pe componentele
 * rețetei, proportional cu procentul fiecareia SI convertind in UM-ul propriu al
 * fiecarei componente (migrarea 0028):
 *
 *   qty_componenta = (percentage / 100 * totalQty) / conversion_factor
 *
 * Inainte, procentul se aplica peste cantitati brute, indiferent de unitate (1 kg
 * = 1 litru = 1 mc) - bug raportat pe o reteta de beton cu apa/nisip/ciment in
 * UM-uri diferite. `conversion_factor` implicit 1 => comportament identic cu cel
 * vechi cand UM-urile coincid.
 *
 * Valabila pentru AMBELE directii ale retetei: la `compunere` totalul e
 * cantitatea de output dorita, la `descompunere` e cantitatea de input consumata.
 */
export function distributeByPercentage(
  components: RecipeComponent[],
  totalQty: number,
): DistributedLine[] {
  if (!Number.isFinite(totalQty) || totalQty <= 0) {
    throw new Error("Cantitatea trebuie sa fie mai mare ca zero.");
  }
  return components.map((component) => {
    const factor = component.conversionFactor > 0 ? component.conversionFactor : 1;
    const qtyInRecipeUnit = totalQty * (component.percentage / 100);
    return {
      itemId: component.componentItemId,
      itemTitle: component.componentItemTitle,
      unit: component.unit,
      percentage: component.percentage,
      conversionFactor: factor,
      qty: roundQty(qtyInRecipeUnit / factor),
      qtyInRecipeUnit: roundQty(qtyInRecipeUnit),
      isTracked: component.isTracked,
    };
  });
}

/** 4a - cantitatea de consumat din fiecare componenta, pentru output-ul dorit. */
export const computeRequiredConsumption = distributeByPercentage;

/** 4b - outputul ideal (fractii), conform "rețetei" materialului de input. */
export const computeIdealOutput = distributeByPercentage;

/**
 * Converteste o cantitate din UM-ul unei componente in UM-ul itemului retetei
 * (inversul impartirii din `distributeByPercentage`) - folosit cand utilizatorul
 * introduce MANUAL cantitati reale pe componente (4b) si vrem un total/balanta
 * comparabile cu cantitatea de input.
 */
export function toRecipeUnit(qtyInComponentUnit: number, conversionFactor: number): number {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  return roundQty(qtyInComponentUnit * factor);
}

/**
 * Suma cantitatilor dintr-o lista de linii, in UM-ul PROPRIU al fiecarei linii.
 * ATENTIE: are sens doar cand toate liniile au aceeasi UM - pentru totaluri peste
 * componente cu UM-uri diferite foloseste `sumQtyInRecipeUnit`.
 */
export function sumQty(lines: { qty: number }[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.qty, 0));
}

/**
 * Suma cantitatilor exprimate in UM-ul itemului retetei - singura suma omogena
 * cand componentele au UM-uri diferite (kg + litru + mc). Asta e valoarea care se
 * compara cu cantitatea totala de input/output in `computeLoss`.
 */
export function sumQtyInRecipeUnit(lines: { qtyInRecipeUnit: number }[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.qtyInRecipeUnit, 0));
}

/**
 * Randament/pierderi - diferenta intre masa totala de input si cea de output
 * (informativ; se INREGISTREAZA, nu se VALIDEAZA - AGENTS.md §4). Pozitiv =
 * pierdere (output < input, normal la reciclare/recondiționare).
 *
 * PRECONDITIE (migrarea 0028): ambele totaluri trebuie sa fie deja exprimate in
 * ACEEASI unitate - in practica, UM-ul itemului retetei, adica sumele calculate
 * cu `sumQtyInRecipeUnit` / `toRecipeUnit`. Inainte functia scadea numere brute
 * din UM-uri diferite (1 litru "egal" cu 1 mc), ceea ce facea pierderea afisata
 * lipsita de sens la retetele cu unitati mixte.
 */
export function computeLoss(totalInputQty: number, totalOutputQty: number): number {
  return roundQty(totalInputQty - totalOutputQty);
}
