import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { getCurrentOrg } from "@/features/auth/queries";
import { getCurrentUser, homePathForRole, isOrgSuspended } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Organizatie suspendata — Lateris Trace" };

/**
 * Pagina dedicata (guard T2.1): singura ruta de business la care mai ajunge un
 * user (admin/operator/client) al unei organizatii suspendate — middleware-ul
 * (`updateSession`) si `requireUser` redirectioneaza aici in loc de shell-ul lor.
 *
 * IMPORTANT: foloseste `getCurrentUser` direct, NU `requireUser`/`requireRole` — acelea
 * ar redirectiona un user suspendat inapoi catre aceasta pagina (bucla infinita).
 */
export default async function OrganizatieSuspendataPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Userii care NU sunt intr-o organizatie suspendata (super_admin sau organizatie
  // reactivata) nu au ce cauta aici — trimite-i la shell-ul propriu.
  if (!isOrgSuspended(user)) redirect(homePathForRole(user.role));

  const org = await getCurrentOrg();

  return (
    <main className="bg-pattern flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <Ban className="size-8" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {org?.name ?? "Organizatia"} este suspendata
          </h1>
          <p className="text-sm text-muted-foreground">
            Contul tau ({user.email ?? "utilizator"}) nu mai are acces la platforma, deoarece
            organizatia din care faci parte a fost suspendata. Contacteaza administratorul
            platformei pentru a reactiva accesul.
          </p>
        </div>
        <SignOutButton />
      </div>
    </main>
  );
}
