import type { UserRole } from "@/features/auth/session";

/** Cine incearca sa (re)activeze + profilul tinta (subset). */
export interface DeactivationActor {
  id: string;
  role: UserRole;
  organizationId: string | null;
}

export interface DeactivationTarget {
  id: string;
  role: UserRole;
  organizationId: string | null;
}

/**
 * Regula PURA "poate `actor` sa dezactiveze/reactiveze contul `target`?"
 * (migrarea 0035). Intoarce mesajul de eroare (romana) sau `null` daca e permis.
 *
 * - doar un ADMIN al organizatiei (RLS `profiles_update` impune acelasi lucru);
 * - doar conturi de STAFF (admin/operator) din aceeasi organizatie - utilizatorul
 *   unui client se blocheaza/deblocheaza prin arhivarea/restaurarea clientului;
 * - niciodata propriul cont (trigger DB `US001` - altfel adminul s-ar putea
 *   bloca singur afara din organizatie).
 */
export function deactivationError(
  actor: DeactivationActor,
  target: DeactivationTarget,
): string | null {
  if (actor.role !== "admin" || !actor.organizationId) {
    return "Doar administratorul organizației poate dezactiva utilizatori.";
  }
  if (target.id === actor.id) return "Nu îți poți dezactiva propriul cont.";
  if (target.organizationId !== actor.organizationId) {
    return "Utilizatorul nu face parte din organizația ta.";
  }
  if (target.role !== "admin" && target.role !== "operator") {
    return "Contul unui client se blochează arhivând clientul (din ecranul Clienți).";
  }
  return null;
}
