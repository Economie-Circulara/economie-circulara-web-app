/**
 * Validari pure (fara efecte secundare) pentru editorul de retete — usor de testat
 * izolat. Reflecta regulile de business din AGENTS.md/handoff: procente 0-100,
 * fara auto-referinta, suma procentelor DOAR informativa (nu blocheaza salvarea).
 */

/** Valideaza un procent de componenta: numar finit, in intervalul (0, 100]. */
export function validatePercentage(value: number): string | null {
  if (!Number.isFinite(value)) return "Procentul trebuie să fie un număr.";
  if (value <= 0) return "Procentul trebuie să fie mai mare ca 0.";
  if (value > 100) return "Procentul nu poate depăși 100.";
  return null;
}

/** Un item nu poate fi componenta propriei retete. */
export function validateNotSelfReference(itemId: string, componentItemId: string): string | null {
  return itemId === componentItemId ? "Un item nu poate fi componenta propriei rețete." : null;
}

/** Suma procentelor componentelor unei retete. */
export function sumPercentages(components: { percentage: number }[]): number {
  return components.reduce((sum, c) => sum + c.percentage, 0);
}

/**
 * Suma procentelor e DOAR informativa — reteta se poate salva chiar daca suma nu e
 * 100 (regula din handoff: fara validare stricta a sumei). Returneaza `true` cand
 * suma e (aproximativ) 100, folosit doar pentru un avertisment vizual in UI.
 */
export function isPercentageSumComplete(sum: number, tolerance = 0.01): boolean {
  return Math.abs(sum - 100) <= tolerance;
}
