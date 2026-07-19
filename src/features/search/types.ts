import type { UserRole } from "@/features/auth/session";

/** Tipurile de entitate cautabile — ordinea canonica de grupare e in `labels.ts`. */
export type SearchResultType = "order" | "client" | "lot" | "item" | "certificate";

/** Un rezultat individual de cautare, gata de afisat (label + link catre detaliu). */
export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  /** Titlul principal (ex. numarul comenzii, denumirea clientului). */
  label: string;
  /** Randul secundar, mai discret (ex. clientul comenzii, CUI-ul). */
  sublabel: string | null;
  /** Link catre ecranul de detaliu, deja adaptat rolului (staff vs. client). */
  href: string;
}

/** Un grup de rezultate de acelasi tip, cu eticheta RO de afisat deasupra listei. */
export interface SearchResultGroup {
  type: SearchResultType;
  label: string;
  results: SearchResultItem[];
}

export interface GlobalSearchOptions {
  role: UserRole;
  /** Numar maxim de rezultate per entitate (implicit 5). */
  limit?: number;
}
