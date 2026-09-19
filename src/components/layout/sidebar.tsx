"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  ChevronDown,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  isNavGroup,
  type NavEntry,
  type NavGroup,
  type NavIconName,
  type NavItem,
} from "./nav-config";
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
  help: BookOpen,
  assistant: Bot,
  "users-admin": UserCog,
  stations: MapPin,
};

export interface SidebarProps {
  /** Numele organizatiei (white label). */
  orgName: string;
  /** URL logo organizatie (optional). */
  logoUrl?: string;
  items: NavEntry[];
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

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
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
}

/** Prefixul cheii de localStorage pt. starea extins/pliat a grupurilor din sidebar. */
const GROUP_COLLAPSE_STORAGE_PREFIX = "nav-group-collapsed:";

function SidebarNavGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const hasActiveChild = group.items.some((item) => isItemActive(pathname, item.href));
  const [collapsed, setCollapsed] = useState(false);
  const storageKey = `${GROUP_COLLAPSE_STORAGE_PREFIX}${group.key}`;

  // Implicit extins (randare server + prim randare client identice, fara mismatch
  // de hidratare). Dupa montare: daca grupul contine ruta activa, ramane extins
  // (nu ascundem pagina curenta); altfel respecta starea salvata de utilizator.
  useEffect(() => {
    if (hasActiveChild) return;
    try {
      // La fel ca in theme-toggle.tsx: starea depinde de localStorage, necunoscut pe server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // localStorage indisponibil (mod privat etc.) - ramane extins.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // localStorage indisponibil - starea ramane doar in memorie.
      }
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
      >
        {group.label}
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}
        />
      </button>
      {!collapsed ? (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              active={isItemActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarNav({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-2">
      {items.map((entry) =>
        isNavGroup(entry) ? (
          <SidebarNavGroup
            key={entry.key}
            group={entry}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarNavLink
            key={entry.href}
            item={entry}
            active={isItemActive(pathname, entry.href)}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}

/** Logo-ul platformei, separat de identitatea white-label a tenantului. */
function PlatformLogoLink() {
  return (
    <div className="flex justify-center border-t px-4 py-4">
      <Link
        href="/"
        className="rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lot-cu-lot-logo.svg" alt="Lot cu Lot" className="h-12 w-auto max-w-full" />
      </Link>
    </div>
  );
}

export function Sidebar({ orgName, logoUrl, items }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <SidebarBrand orgName={orgName} logoUrl={logoUrl} />
      <SidebarNav items={items} />
      <PlatformLogoLink />
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
