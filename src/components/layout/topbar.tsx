import { Search } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { UserRole } from "@/features/auth/session";

export interface TopbarProps {
  email: string | null;
  roleLabel: string;
  role: UserRole;
}

/**
 * Doar staff-ul (admin/operator) are bara de căutare cablată — navighează la
 * `/cautare?q=...` (Task X2), pagină aflată în grupul de rute `(admin)`
 * (`requireRole(["admin", "operator"])` în layout-ul acelui grup). Pentru rolul
 * `client` bara nu e afișată aici: scope-ul declarat al Task X2 nu include o
 * rută nouă în grupul `(client)`, iar entitățile cerute pentru client (comenzi/
 * certificate/catalog proprii) au deja ecrane dedicate; vezi
 * `docs/plans/task-x2-cautare.md` pentru detalii/urmărire.
 */
const STAFF_ROLES: UserRole[] = ["admin", "operator"];

/** Bara de sus a shell-ului: căutare globală (doar staff) + identitatea utilizatorului + delogare. */
export function Topbar({ email, roleLabel, role }: TopbarProps) {
  const canSearch = STAFF_ROLES.includes(role);

  return (
    <header className="flex items-center justify-between gap-4 border-b pb-4">
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <div className="flex items-center gap-3">
        {canSearch ? (
          <form
            action="/cautare"
            method="GET"
            className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Caută comenzi, loturi, clienți…"
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
