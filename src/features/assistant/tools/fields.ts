import type { PresentationField } from "./presentation-types";

/**
 * Constructori pentru campurile cardului generic - aceleasi forme ca in
 * `write-tools.ts`, scrise o singura data pentru tool-urile noi.
 */

/** Camp text editabil; `value` gol se afiseaza ca „-”. */
export function textField(name: string, label: string, value: string | null): PresentationField {
  return {
    name,
    label,
    displayValue: value || "-",
    editable: true,
    kind: "text",
    value: value ?? "",
  };
}

export function booleanField(name: string, label: string, value: boolean): PresentationField {
  return { name, label, displayValue: value ? "Da" : "Nu", editable: true, kind: "boolean", value };
}

/** Camp doar-afisare (ID rezolvat la eticheta, efectul actiunii, calcule). */
export function infoField(name: string, label: string, displayValue: string): PresentationField {
  return { name, label, displayValue, editable: false, kind: "text" };
}
