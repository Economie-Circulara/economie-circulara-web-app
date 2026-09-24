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
  | "subscriptions"
  | "recipes"
  | "stock-audit"
  | "reports"
  | "settings"
  | "catalog"
  | "documents"
  | "help"
  | "assistant"
  | "users-admin"
  | "stations"
  | "aport";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  roles: AppRole[];
}

/**
 * Grup de navigatie pliabil (sidebar staff) - ex. "Stoc" grupeaza Materiale /
 * Abonamente / Rețete / Stoc / Audit stoc. `key` e stabila (folosita si ca cheie de
 * persistare a starii extins/pliat in localStorage) - nu depinde de traducerea
 * `label`-ului.
 */
export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/** O intrare de navigatie staff: fie o pagina, fie un grup pliabil de pagini. */
export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/** Aplatizeaza `NavEntry[]` la lista de pagini (grupurile isi expun copiii direct). */
export function flattenNavEntries(entries: NavEntry[]): NavItem[] {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]));
}

/**
 * Navigatie admin / operator (sidebar fix), grupata pe zone functionale. Grupurile
 * sunt doar de prezentare (pliere in sidebar) - fiecare `NavItem` din interior
 * ramane sursa de adevar pt. rol + href, la fel ca inainte de grupare.
 */
export const STAFF_NAV: NavEntry[] = [
  {
    label: "Panou de control",
    href: "/dashboard",
    icon: "dashboard",
    roles: ["admin", "operator"],
  },
  {
    key: "comenzi",
    label: "Comenzi",
    items: [
      { label: "Comenzi", href: "/comenzi", icon: "orders", roles: ["admin", "operator"] },
      { label: "Livrări", href: "/livrari", icon: "deliveries", roles: ["admin", "operator"] },
    ],
  },
  {
    key: "stoc",
    label: "Stoc",
    items: [
      {
        label: "Materiale",
        href: "/itemi",
        icon: "items",
        roles: ["admin", "operator"],
      },
      {
        label: "Abonamente",
        href: "/abonamente",
        icon: "subscriptions",
        roles: ["admin", "operator"],
      },
      { label: "Rețete", href: "/retete", icon: "recipes", roles: ["admin", "operator"] },
      { label: "Stoc", href: "/stoc", icon: "stock", roles: ["admin", "operator"] },
      {
        label: "Audit stoc",
        href: "/stoc/audit",
        icon: "stock-audit",
        roles: ["admin", "operator"],
      },
    ],
  },
  { label: "Clienți", href: "/clienti", icon: "clients", roles: ["admin", "operator"] },
  { label: "Producție", href: "/productie", icon: "production", roles: ["admin", "operator"] },
  { label: "Rapoarte", href: "/rapoarte", icon: "reports", roles: ["admin", "operator"] },
  {
    key: "setari",
    label: "Setări",
    items: [
      { label: "Setări", href: "/setari", icon: "settings", roles: ["admin"] },
      { label: "Utilizatori", href: "/setari/utilizatori", icon: "users-admin", roles: ["admin"] },
      {
        label: "Puncte de plecare",
        href: "/setari/statii",
        icon: "stations",
        roles: ["admin"],
      },
    ],
  },
];

/** Navigatie portal client. */
export const CLIENT_NAV: NavItem[] = [
  { label: "Catalog", href: "/catalog", icon: "catalog", roles: ["client"] },
  { label: "Aport material", href: "/aport-nou", icon: "aport", roles: ["client"] },
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
 * nu in `STAFF_NAV`: `tests/e2e/routes-smoke.spec.ts` foloseste `STAFF_NAV` (aplatizat
 * cu `flattenNavEntries`) ca lista de rute pe care clientul NU are voie, iar `/ajutor`
 * nu e o astfel de ruta.
 */
export const HELP_NAV_ITEM: NavItem = {
  label: "Ajutor",
  href: "/ajutor",
  icon: "help",
  roles: ["super_admin", "admin", "operator", "client"],
};

/** Asistentul AI - la fel ca ajutorul, vizibil tuturor rolurilor si tinut separat. */
export const ASSISTANT_NAV_ITEM: NavItem = {
  label: "Asistent AI",
  href: "/asistent",
  icon: "assistant",
  roles: ["super_admin", "admin", "operator", "client"],
};

/** Filtreaza `STAFF_NAV` pe rol - pastreaza grupurile, dar le elimina daca raman fara copii. */
function filterStaffNavForRole(role: AppRole): NavEntry[] {
  return STAFF_NAV.flatMap((entry): NavEntry[] => {
    if (isNavGroup(entry)) {
      const items = entry.items.filter((item) => item.roles.includes(role));
      return items.length > 0 ? [{ ...entry, items }] : [];
    }
    return entry.roles.includes(role) ? [entry] : [];
  });
}

export function navForRole(role: AppRole): NavEntry[] {
  const shared = [ASSISTANT_NAV_ITEM, HELP_NAV_ITEM];
  if (role === "client") return [...CLIENT_NAV, ...shared];
  return [...filterStaffNavForRole(role), ...shared];
}
