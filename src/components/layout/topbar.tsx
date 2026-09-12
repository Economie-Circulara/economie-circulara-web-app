import { Search } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { UserRole } from "@/features/auth/session";

export interface TopbarProps {
  email: string | null;
  roleLabel: string;
  role: UserRole;
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
export function Topbar({ email, roleLabel, role }: TopbarProps) {
  const searchPath = SEARCH_PATH_BY_ROLE[role];

  return (
    <header className="flex items-center justify-between gap-4 border-b pb-4">
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <div className="flex items-center gap-3">
        {searchPath ? (
          <form
            action={searchPath}
            method="GET"
            className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder={SEARCH_PLACEHOLDER_BY_ROLE[role]}
              aria-label="Căutare globală"
              className="w-56 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </form>
        ) : null}
        <span className="text-sm font-medium">{email}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
