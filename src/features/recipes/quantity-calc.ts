/**
 * Calcule pure pentru modul de input "Cantități reale" al editorului de rețete
 * (docs/plans/reteta-vizuala.md). Stocarea rămâne procente
 * (`recipe_components.percentage` + `conversion_factor`, AGENTS.md §4) - modulul
 * asta traduce DOAR intre cantitati reale (in UM-ul retetei - faza 1, fara
 * conversii de UM) si procente, pentru un UX mai usor de gandit de un utilizator
 * non-tehnic.
 *
 * Nicio functie de-aici nu valideaza reguli de business (asta ramane in
 * `validation.ts`) - sunt calcule, nu validari.
 */

export const QUANTITY_DECIMALS = 3; // aceeasi precizie ca `roundQty` din production/calc.ts
export const PERCENTAGE_DECIMALS = 3;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Rotunjire "resturi celor mai mari" (largest remainder): rotunjeste fiecare
 * valoare la `decimals` zecimale, dar suma valorilor rotunjite este GARANTAT
 * egala cu suma totala rotunjita la aceleasi zecimale - spre deosebire de
 * rotunjirea independenta a fiecarei valori, care poate produce o suma cu 0.001
 * in plus sau in minus (relevant cand utilizatorul se asteapta ca procentele
 * componentelor sa insumeze exact 100.000, nu 99.999 sau 100.001).
 *
 * Valori goale -> `[]`. Valori negative sunt acceptate ca atare (nu e treaba
 * acestei functii sa le respinga).
 */
export function distributeExact(values: number[], decimals = QUANTITY_DECIMALS): number[] {
  if (values.length === 0) return [];

  const factor = 10 ** decimals;
  const total = values.reduce((sum, value) => sum + value, 0);
  const targetUnits = Math.round(total * factor);

  const baseUnits = values.map((value) => Math.floor(value * factor + 1e-9));
  const baseSum = baseUnits.reduce((sum, value) => sum + value, 0);
  const remainder = targetUnits - baseSum;

  const byFractionDesc = values
    .map((value, index) => ({ index, fraction: value * factor - baseUnits[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  const resultUnits = [...baseUnits];
  if (remainder > 0) {
    for (let k = 0; k < remainder; k++) {
      resultUnits[byFractionDesc[k % byFractionDesc.length].index] += 1;
    }
  } else if (remainder < 0) {
    const byFractionAsc = [...byFractionDesc].reverse();
    for (let k = 0; k < -remainder; k++) {
      resultUnits[byFractionAsc[k % byFractionAsc.length].index] -= 1;
    }
  }

  return resultUnits.map((units) => units / factor);
}

export interface QuantityComponent {
  id: string;
  quantity: number;
}

export interface PercentageComponent {
  id: string;
  percentage: number;
}

/**
 * Cantitati reale (in UM-ul rețetei) -> procente. Cand `batchQty` e zero, negativ
 * sau nu e finit (cantitate de baza necompletata inca), sau lista e goala,
 * intoarce 0% pentru toate componentele - nu arunca eroare, ca UI-ul sa poata
 * afisa un formular gol fara sa se blocheze.
 */
export function quantitiesToPercentages(
  batchQty: number,
  components: QuantityComponent[],
): PercentageComponent[] {
  if (!Number.isFinite(batchQty) || batchQty <= 0 || components.length === 0) {
    return components.map((c) => ({ id: c.id, percentage: 0 }));
  }
  const raw = components.map((c) => (c.quantity / batchQty) * 100);
  const rounded = distributeExact(raw, PERCENTAGE_DECIMALS);
  return components.map((c, i) => ({ id: c.id, percentage: rounded[i] }));
}

/**
 * Procente -> cantitati reale (in UM-ul rețetei). Vezi `quantitiesToPercentages`
 * pentru cazurile-limita (batch invalid/gol -> 0 pentru toate).
 */
export function percentagesToQuantities(
  batchQty: number,
  components: PercentageComponent[],
): QuantityComponent[] {
  if (!Number.isFinite(batchQty) || batchQty <= 0 || components.length === 0) {
    return components.map((c) => ({ id: c.id, quantity: 0 }));
  }
  const raw = components.map((c) => (c.percentage / 100) * batchQty);
  const rounded = distributeExact(raw, QUANTITY_DECIMALS);
  return components.map((c, i) => ({ id: c.id, quantity: rounded[i] }));
}

/** Suma cantitatilor (UM-ul rețetei), rotunjita. */
export function sumQuantities(components: { quantity: number }[]): number {
  return roundTo(
    components.reduce((sum, c) => sum + c.quantity, 0),
    QUANTITY_DECIMALS,
  );
}

/** Suma procentelor - poate fi diferita de 100 (informativ, AGENTS.md §4). */
export function sumPercentages(components: { percentage: number }[]): number {
  return roundTo(
    components.reduce((sum, c) => sum + c.percentage, 0),
    PERCENTAGE_DECIMALS,
  );
}

/**
 * Calculatorul "Pentru [X] {unitate}" - rescaleaza cantitatile la orice cantitate
 * de baza tinta, pastrand procentele curente ale componentelor (nu suprascrie
 * rândurile din editor - e doar o previzualizare).
 */
export function scaleQuantities(
  targetBatchQty: number,
  components: PercentageComponent[],
): QuantityComponent[] {
  return percentagesToQuantities(targetBatchQty, components);
}

export interface BarSegment {
  id: string;
  percentage: number;
  /** Latimea segmentului ca procent din latimea barei (0-100), normalizata la suma. */
  widthPercent: number;
  locked?: boolean;
}

/**
 * Latimile segmentelor barei de proportii, normalizate la 100% latime, indiferent
 * daca suma procentelor componentelor e 100 (Producție cu pierderi poate depasi
 * 100%, Reciclare cu pierderi poate fi sub 100% - AGENTS.md §4). Cand suma e 0
 * (nicio cantitate introdusa inca), imparte latimea egal intre componente, ca bara
 * sa nu dispara complet.
 */
export function computeSegmentWidths(
  components: { id: string; percentage: number; locked?: boolean }[],
): BarSegment[] {
  const total = components.reduce((sum, c) => sum + Math.max(c.percentage, 0), 0);
  if (total <= 0) {
    const equalWidth = components.length > 0 ? 100 / components.length : 0;
    return components.map((c) => ({
      id: c.id,
      percentage: c.percentage,
      widthPercent: equalWidth,
      locked: c.locked,
    }));
  }
  return components.map((c) => ({
    id: c.id,
    percentage: c.percentage,
    widthPercent: (Math.max(c.percentage, 0) / total) * 100,
    locked: c.locked,
  }));
}

/**
 * Muta granita dintre segmentul `dividerIndex` si `dividerIndex + 1`: transfera
 * `deltaPercentPoints` puncte procentuale din segmentul din stanga in cel din
 * dreapta (sau invers, daca `deltaPercentPoints` e negativ). Suma TOTALA a
 * procentelor tuturor componentelor ramane neschimbata - dragging redistribuie,
 * nu adauga/scade material.
 *
 * Nu face nimic (intoarce lista neschimbata) daca oricare dintre cele doua
 * segmente adiacente e blocat (`locked`) sau daca indexul e in afara listei -
 * granitele adiacente unui segment blocat nu sunt trăgabile in UI.
 *
 * Clampeaza mutarea ca niciun segment sa nu scada sub 0%.
 */
export function applyDividerDrag<T extends { id: string; percentage: number; locked?: boolean }>(
  components: T[],
  dividerIndex: number,
  deltaPercentPoints: number,
): T[] {
  const left = components[dividerIndex];
  const right = components[dividerIndex + 1];
  if (!left || !right || left.locked || right.locked || !Number.isFinite(deltaPercentPoints)) {
    return components;
  }

  const clampedDelta = Math.max(-left.percentage, Math.min(right.percentage, deltaPercentPoints));
  if (clampedDelta === 0) return components;

  return components.map((c, i) => {
    if (i === dividerIndex) {
      return { ...c, percentage: roundTo(c.percentage + clampedDelta, PERCENTAGE_DECIMALS) };
    }
    if (i === dividerIndex + 1) {
      return { ...c, percentage: roundTo(c.percentage - clampedDelta, PERCENTAGE_DECIMALS) };
    }
    return c;
  });
}
