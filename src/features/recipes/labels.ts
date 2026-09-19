import type { RecipeDirection } from "./types";

export const DIRECTION_LABELS: Record<RecipeDirection, string> = {
  compunere: "Compunere (produsul se obține din componente)",
  descompunere: "Descompunere (produsul se descompune în componente)",
};

/** Varianta scurta, pentru badge-uri si tabele. */
export const DIRECTION_SHORT_LABELS: Record<RecipeDirection, string> = {
  compunere: "Compunere",
  descompunere: "Descompunere",
};

export const DIRECTION_OPTIONS: RecipeDirection[] = ["compunere", "descompunere"];

/** Explicatia afisata sub selectorul de directie si in editorul de rețetă. */
export const DIRECTION_DESCRIPTIONS: Record<RecipeDirection, string> = {
  compunere:
    "Acest produs se obține din componentele de mai jos - ele se CONSUMĂ din stoc " +
    "(ex: beton ← apă + nisip + ciment).",
  descompunere:
    "Acest produs se descompune în componentele de mai jos - ele se PRODUC, iar " +
    "produsul se consumă (ex: reciclare, moloz → nisip + pietriș + balast).",
};

/** Ce reprezinta procentul unei componente, in functie de directie. */
export const DIRECTION_PERCENTAGE_HINTS: Record<RecipeDirection, string> = {
  compunere:
    "Cât intră din componentă raportat la cantitatea de produs obținută. Poate depăși " +
    "100% (input mai mare decât outputul, la rețete cu pierderi).",
  descompunere:
    "Cât rezultă din componentă raportat la cantitatea de produs descompusă. Suma sub " +
    "100% = pierdere la procesare (informativ, nu blochează salvarea).",
};

/** Rolul componentelor in proces (input/output), derivat din directie. */
export const DIRECTION_COMPONENT_ROLE: Record<RecipeDirection, string> = {
  compunere: "Componente consumate (input)",
  descompunere: "Fracții rezultate (output)",
};
