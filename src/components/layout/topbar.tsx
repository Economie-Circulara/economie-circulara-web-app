import { Search } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { UserRole } from "@/features/auth/session";
import type { NavItem } from "./nav-config";
import { MobileSidebar } from "./sidebar";

export interface TopbarProps {
  email: string | null;
  roleLabel: string;
  role: UserRole;
  orgName?: string;
  logoUrl?: string;
  items?: NavItem[];
}

/**
 * Path-ul paginii de rezultate a căutării globale, per rol (fix F7b — grupurile
 * de rute `(admin)`/`(client)` nu pot defini același path, deci fiecare are
 * pagina lui: staff → `/cautare` (`src/app/(admin)/cautare/page.tsx`), client →
 * `/cauta` (`src/app/(client)/cauta/page.tsx`). Alte roluri (super_admin) nu au
 * bară de căutare — `globalSearch` oricum întoarce `[]` pentru ele.
 */
const SEARCH_PATH_BY_ROLE: Partial<Record<UserRole, string>> = {
  admin: "/cautare",
  operator: "/cautare",
  client: "/cauta",
};

/** Placeholder-ul bării de căutare, per rol — clientul nu caută loturi/clienți (AGENTS.md §4). */
const SEARCH_PLACEHOLDER_BY_ROLE: Partial<Record<UserRole, string>> = {
  admin: "Caută comenzi, loturi, clienți…",
  operator: "Caută comenzi, loturi, clienți…",
  client: "Caută comenzi, certificate, produse…",
};

/** Bara de sus a shell-ului: căutare globală (staff + client) + identitatea utilizatorului + delogare. */
export function Topbar({ email, roleLabel, role, orgName, logoUrl, items }: TopbarProps) {
  const searchPath = SEARCH_PATH_BY_ROLE[role];
  const showMobileNav = orgName && items && items.length > 0;

  return (
    <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {showMobileNav ? <MobileSidebar orgName={orgName} logoUrl={logoUrl} items={items} /> : null}
        <span className="truncate text-sm text-muted-foreground">{roleLabel}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
        {searchPath ? (
          <form
            action={searchPath}
            method="GET"
            className="order-3 flex min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 sm:order-none sm:basis-auto sm:flex-none"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder={SEARCH_PLACEHOLDER_BY_ROLE[role]}
              aria-label="Căutare globală"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:w-56"
            />
          </form>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium sm:flex-none">{email}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
