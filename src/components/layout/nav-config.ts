import {
  Boxes,
  Factory,
  FileText,
  History,
  LayoutGrid,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "super_admin" | "admin" | "operator" | "client";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
}

/** Navigatie admin / operator (sidebar fix). Setari doar pentru admin. */
export const STAFF_NAV: NavItem[] = [
  { label: "Comenzi", href: "/comenzi", icon: ShoppingCart, roles: ["admin", "operator"] },
  { label: "Stoc", href: "/stoc", icon: Boxes, roles: ["admin", "operator"] },
  { label: "Producție", href: "/productie", icon: Factory, roles: ["admin", "operator"] },
  { label: "Clienți", href: "/clienti", icon: Users, roles: ["admin", "operator"] },
  { label: "Rețete", href: "/retete", icon: ScrollText, roles: ["admin", "operator"] },
  { label: "Audit stoc", href: "/audit", icon: History, roles: ["admin", "operator"] },
  { label: "Setări", href: "/setari", icon: Settings, roles: ["admin"] },
];

/** Navigatie portal client. */
export const CLIENT_NAV: NavItem[] = [
  { label: "Catalog", href: "/catalog", icon: LayoutGrid, roles: ["client"] },
  { label: "Comenzile mele", href: "/comenzile-mele", icon: ShoppingCart, roles: ["client"] },
  {
    label: "Documente & Certificate",
    href: "/documente",
    icon: FileText,
    roles: ["client"],
  },
];

export function navForRole(role: AppRole): NavItem[] {
  if (role === "client") return CLIENT_NAV;
  return STAFF_NAV.filter((item) => item.roles.includes(role));
}
