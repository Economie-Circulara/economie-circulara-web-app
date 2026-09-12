"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName, NavItem } from "./nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Maparea cheie de icon -> componenta Lucide. Trebuie sa stea in acest modul
 * client: `nav-config.ts` e importat si de layout-urile server, iar o referinta
 * de componenta nu poate traversa granita RSC (vezi comentariul din nav-config.ts).
 */
const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  deliveries: Truck,
  stock: Boxes,
  production: Factory,
  clients: Users,
  items: Package,
  recipes: ScrollText,
  "stock-audit": History,
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

function SidebarBrand({ orgName, logoUrl }: Pick<SidebarProps, "orgName" | "logoUrl">) {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4 pr-10">
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
  );
}

function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
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
  );
}

export function Sidebar({ orgName, logoUrl, items }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <SidebarBrand orgName={orgName} logoUrl={logoUrl} />
      <SidebarNav items={items} />
    </aside>
  );
}

export function MobileSidebar({ orgName, logoUrl, items }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="lg:hidden">
          <Menu className="size-4" />
          <span className="sr-only">Deschide meniul</span>
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby="mobile-sidebar-description">
        <SheetTitle className="sr-only">Navigație</SheetTitle>
        <SheetDescription id="mobile-sidebar-description" className="sr-only">
          Meniu principal pentru navigarea în aplicație.
        </SheetDescription>
        <SidebarBrand orgName={orgName} logoUrl={logoUrl} />
        <SidebarNav items={items} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
