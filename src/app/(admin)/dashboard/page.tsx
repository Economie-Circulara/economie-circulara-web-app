import { requireRole } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Dashboard — Lateris Trace" };

/** Ecran admin/operator. Shell-ul complet (sidebar + ecrane) vine in Wave 2. */
export default async function DashboardPage() {
  const user = await requireRole(["admin", "operator", "super_admin"]);

  return (
    <main className="bg-pattern flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Conectat ca <strong>{user.email}</strong> ({user.role}).
      </p>
      <p className="text-sm text-muted-foreground">
        Ecranele de business (comenzi, stoc, productie) se adauga in Wave 2.
      </p>
      <SignOutButton />
    </main>
  );
}
