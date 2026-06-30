import { requireRole } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Platforma — Lateris Trace" };

/** Consola super-admin (management organizatii). Continutul vine in Wave 2 (Task I). */
export default async function PlatformPage() {
  const user = await requireRole(["super_admin"]);

  return (
    <main className="bg-pattern flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Administrare platforma</h1>
      <p className="text-muted-foreground">
        Conectat ca <strong>{user.email}</strong> (super-admin).
      </p>
      <p className="text-sm text-muted-foreground">
        Managementul organizatiilor se adauga in Wave 2.
      </p>
      <SignOutButton />
    </main>
  );
}
