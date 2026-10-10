import { notFound } from "next/navigation";
import { getCurrentOrg } from "@/features/auth/queries";
import { hasModule, type ModuleKey } from "./modules";

/**
 * Garda pentru rutele si server actions ale unui modul: daca organizatia userului nu
 * are modulul activ, raspunsul e 404 (ca o ruta inexistenta). RLS-ul tabelelor
 * modulului (`app.org_has_module`, 0055) e a doua linie de aparare.
 */
export async function requireModule(key: ModuleKey): Promise<void> {
  const org = await getCurrentOrg();
  if (!hasModule(org, key)) notFound();
}
