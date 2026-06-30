/**
 * Acces tipat la variabilele de mediu publice Supabase. Esueaza devreme, cu un mesaj
 * clar, daca lipsesc (in loc sa pice undeva adanc in clientul Supabase).
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variabila de mediu lipsa: ${name}. Copiaza .env.example in .env.local si completeaz-o.`,
    );
  }
  return value;
}

export function getSupabaseEnv() {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
