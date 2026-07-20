"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey, NavItem } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Maparea cheie -> componenta lucide. Traieste aici (Client Component) fiindca
 * componentele-icon nu pot fi trecute peste granita server->client; config-ul de
 * navigatie transporta doar cheia serializabila (vezi `nav-config.ts`).
 */
const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  deliveries: Truck,
  stock: Boxes,
  production: Factory,
  clients: Users,
  items: Package,
  recipes: ScrollText,
  audit: History,
  reports: BarChart3,
  settings: Settings,
  catalog: LayoutGrid,
  documents: FileText,
};

export interface SidebarProps {
  /** Numele organizatiei (white label). */
  orgName: string;
  /** URL logo organizatie (optional). */
  logoUrl?: string;
  items: NavItem[];
}

export function Sidebar({ orgName, logoUrl, items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName} className="size-7 rounded object-contain" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            {orgName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="truncate font-semibold">{orgName}</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = NAV_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
