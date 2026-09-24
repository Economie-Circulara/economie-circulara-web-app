import { redirect } from "next/navigation";
import { UserX } from "lucide-react";
import { getCurrentUser, homePathForRole, isAccountDeactivated } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Cont dezactivat - Lot cu Lot" };

/**
 * Pagina dedicata unui CONT dezactivat (migrarea 0035): utilizator de staff
 * dezactivat de administrator, sau utilizator-client al unei firme arhivate.
 * Middleware-ul (`updateSession`) si `requireUser` redirectioneaza aici.
 *
 * IMPORTANT: foloseste `getCurrentUser` direct, NU `requireUser` (bucla de redirect) -
 * acelasi tipar ca `/organizatie-suspendata`.
 */
export default async function ContDezactivatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Contul a fost reactivat intre timp - inapoi in shell-ul propriu.
  if (!isAccountDeactivated(user)) redirect(homePathForRole(user.role));

  return (
    <main className="bg-pattern flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <UserX className="size-8" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Contul tău este dezactivat</h1>
          <p className="text-sm text-muted-foreground">
            Contul {user.email ?? ""} nu mai are acces la platformă. Dacă crezi că este o greșeală,
            contactează administratorul organizației - el îți poate reactiva accesul.
          </p>
        </div>
        <SignOutButton />
      </div>
    </main>
  );
}
