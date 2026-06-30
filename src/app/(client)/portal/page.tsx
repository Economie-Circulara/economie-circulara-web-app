import { requireRole } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Portal — Lateris Trace" };

/** Portalul clientului (catalog, comenzi proprii). Continutul vine in Wave 2 (Task H). */
export default async function PortalPage() {
  const user = await requireRole(["client"]);

  return (
    <main className="bg-pattern flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Portal client</h1>
      <p className="text-muted-foreground">
        Conectat ca <strong>{user.email}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Catalogul si comenzile tale apar aici in Wave 2.
      </p>
      <SignOutButton />
    </main>
  );
}
