import type { RecipeDirection } from "./types";

export const DIRECTION_LABELS: Record<RecipeDirection, string> = {
  compunere: "Producție (se obține din materii prime)",
  descompunere: "Reciclare (se descompune în materii prime)",
};

/** Varianta scurta, pentru badge-uri si tabele. */
export const DIRECTION_SHORT_LABELS: Record<RecipeDirection, string> = {
  compunere: "Producție",
  descompunere: "Reciclare",
};

export const DIRECTION_OPTIONS: RecipeDirection[] = ["compunere", "descompunere"];

/** Explicatia afisata sub selectorul de metoda si in editorul de rețetă. */
export const DIRECTION_DESCRIPTIONS: Record<RecipeDirection, string> = {
  compunere:
    "Acest produs se obține din materiile prime de mai jos - ele se CONSUMĂ din stoc " +
    "(ex: beton ← apă + nisip + ciment).",
  descompunere:
    "Acest produs se descompune în materiile prime de mai jos - ele se PRODUC, iar " +
    "produsul se consumă (ex: reciclare, moloz → nisip + pietriș + balast).",
};

/** Ce reprezinta procentul unei materii prime, in functie de metoda. */
export const DIRECTION_PERCENTAGE_HINTS: Record<RecipeDirection, string> = {
  compunere:
    "Cât intră din materia primă raportat la cantitatea de produs obținută. Poate depăși " +
    "100% (se consumă mai mult decât se produce, la rețete cu pierderi).",
  descompunere:
    "Cât rezultă din materia primă raportat la cantitatea de produs descompusă. Suma sub " +
    "100% = pierdere la procesare (informativ, nu blochează salvarea).",
};

/** Rolul materiilor prime in proces (consumate/rezultate), derivat din metoda. */
export const DIRECTION_COMPONENT_ROLE: Record<RecipeDirection, string> = {
  compunere: "Materii prime",
  descompunere: "Materiale rezultate",
};
