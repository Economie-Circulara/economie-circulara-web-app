export type AppRole = "super_admin" | "admin" | "operator" | "client";

/**
 * Cheia iconitei de navigatie. NU se pune aici componenta Lucide propriu-zisa:
 * `navForRole()` e apelat in layout-urile SERVER (`src/app/(admin)/layout.tsx`,
 * `src/app/(client)/layout.tsx`), iar rezultatul e pasat ca prop catre `Sidebar`,
 * care e `"use client"`. O referinta de componenta (forwardRef) nu e serializabila
 * peste granita RSC - Next 16/React 19 arunca
 * "Functions cannot be passed directly to Client Components" si pagina da 500.
 * Maparea cheie -> componenta Lucide se face in `sidebar.tsx` (modul client).
 */
export type NavIconName =
  | "dashboard"
  | "orders"
  | "deliveries"
  | "stock"
  | "production"
  | "clients"
  | "items"
  | "recipes"
  | "stock-audit"
  | "reports"
  | "settings"
  | "catalog"
  | "documents"
  | "help";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  roles: AppRole[];
}

/** Navigatie admin / operator (sidebar fix). Setari doar pentru admin. */
export const STAFF_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", roles: ["admin", "operator"] },
  { label: "Comenzi", href: "/comenzi", icon: "orders", roles: ["admin", "operator"] },
  { label: "Livrări", href: "/livrari", icon: "deliveries", roles: ["admin", "operator"] },
  { label: "Stoc", href: "/stoc", icon: "stock", roles: ["admin", "operator"] },
  { label: "Producție", href: "/productie", icon: "production", roles: ["admin", "operator"] },
  { label: "Clienți", href: "/clienti", icon: "clients", roles: ["admin", "operator"] },
  { label: "Itemi", href: "/itemi", icon: "items", roles: ["admin", "operator"] },
  { label: "Rețete", href: "/retete", icon: "recipes", roles: ["admin", "operator"] },
  { label: "Audit stoc", href: "/stoc/audit", icon: "stock-audit", roles: ["admin", "operator"] },
  { label: "Rapoarte", href: "/rapoarte", icon: "reports", roles: ["admin", "operator"] },
  { label: "Setări", href: "/setari", icon: "settings", roles: ["admin"] },
];

/** Navigatie portal client. */
export const CLIENT_NAV: NavItem[] = [
  { label: "Catalog", href: "/catalog", icon: "catalog", roles: ["client"] },
  { label: "Comenzile mele", href: "/comenzile-mele", icon: "orders", roles: ["client"] },
  {
    label: "Documente & Certificate",
    href: "/documente",
    icon: "documents",
    roles: ["client"],
  },
];

/**
 * Ajutorul (manualul din aplicatie) e vizibil TUTUROR rolurilor, deci sta separat,
 * nu in `STAFF_NAV`: `tests/e2e/routes-smoke.spec.ts` foloseste `STAFF_NAV` ca lista
 * de rute pe care clientul NU are voie, iar `/ajutor` nu e o astfel de ruta.
 */
export const HELP_NAV_ITEM: NavItem = {
  label: "Ajutor",
  href: "/ajutor",
  icon: "help",
  roles: ["super_admin", "admin", "operator", "client"],
};

export function navForRole(role: AppRole): NavItem[] {
  if (role === "client") return [...CLIENT_NAV, HELP_NAV_ITEM];
  return [...STAFF_NAV.filter((item) => item.roles.includes(role)), HELP_NAV_ITEM];
}
