import { requireRole, type SessionUser } from "@/features/auth/session";
import { requireModule } from "@/features/modules/guard";
import { ASSISTANT_ROLES } from "./access";

/**
 * Garda unica a asistentului (pagini, rute, server actions): rolul trebuie sa aiba
 * asistent (ASSISTANT_ROLES, fara client) SI organizatia trebuie sa aiba modulul
 * `assistant` activ (0055) - altfel 404. Super-adminul n-are organizatie, deci nu
 * depinde de modul. In DB, acelasi lucru il impune `app.can_use_assistant()`.
 */
export async function requireAssistantUser(): Promise<SessionUser> {
  const user = await requireRole(ASSISTANT_ROLES);
  if (user.role !== "super_admin") await requireModule("assistant");
  return user;
}
