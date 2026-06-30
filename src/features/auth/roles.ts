import type { UserRole } from "./session";

/** Eticheta in romana pentru un rol (UI). */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super-admin",
  admin: "Administrator",
  operator: "Operator",
  client: "Client",
};
