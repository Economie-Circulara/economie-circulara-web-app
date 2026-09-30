import type { UserRole } from "@/features/auth/session";

/**
 * Rolurile care folosesc asistentul AI (decizie 2026-09-30): staff-ul organizatiei
 * si super-adminul. Clientul NU are asistent - nici in meniu, nici pe rute, nici in
 * server actions, nici in DB (migrarea 0054).
 */
export const ASSISTANT_ROLES: UserRole[] = ["super_admin", "admin", "operator"];

export function canUseAssistant(role: UserRole): boolean {
  return ASSISTANT_ROLES.includes(role);
}
