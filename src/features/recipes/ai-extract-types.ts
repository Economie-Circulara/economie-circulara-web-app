/**
 * Tipuri pentru tab-ul "Din text (AI)" al editorului de rețetă
 * (docs/plans/reteta-ai.md). O componenta extrasa de model dintr-un text liber -
 * inca NEVALIDATA structural (asta face `ai-extract-parse.ts`) si NEPOTRIVITA cu
 * un material din organizatie (asta face `ai-extract-match.ts`).
 */
export interface ExtractedComponent {
  /** Numele materiei prime, exact cum l-a scris/copiat utilizatorul in text. */
  name: string;
  quantity: number;
  unit: string;
}

export interface ExtractedRecipe {
  batchQuantity: number;
  unit: string;
  components: ExtractedComponent[];
}

/** O componenta extrasa, dupa potrivirea cu un material existent al organizatiei. */
export interface MatchedComponent {
  extracted: ExtractedComponent;
  itemId: string | null;
  itemTitle: string | null;
  itemUnit: string | null;
  /** 0 (nicio potrivire) - 1 (potrivire exacta). */
  confidence: number;
}

/** Un material al organizatiei, candidat pentru potrivire (fara alte detalii). */
export interface ItemMatchCandidate {
  id: string;
  title: string;
  unit: string;
}
