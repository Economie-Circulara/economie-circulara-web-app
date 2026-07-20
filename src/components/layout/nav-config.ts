export type AppRole = "super_admin" | "admin" | "operator" | "client";

/**
 * Cheie de icon (nu componenta in sine). Config-ul de navigatie e importat si de
 * Server Components (layout-urile (admin)/(client) care apeleaza `navForRole`),
 * iar rezultatul e trimis catre `Sidebar` — un Client Component. React nu permite
 * trecerea de functii/componente peste granita server->client, asa ca stocam doar
 * o cheie serializabila; maparea cheie -> componenta lucide traieste in `Sidebar`.
 */
export type NavIconKey =
  | "dashboard"
  | "orders"
  | "deliveries"
  | "stock"
  | "production"
  | "clients"
  | "items"
  | "recipes"
  | "audit"
  | "reports"
  | "settings"
  | "catalog"
  | "documents";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconKey;
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
  { label: "Audit stoc", href: "/stoc/audit", icon: "audit", roles: ["admin", "operator"] },
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

export function navForRole(role: AppRole): NavItem[] {
  if (role === "client") return CLIENT_NAV;
  return STAFF_NAV.filter((item) => item.roles.includes(role));
}
