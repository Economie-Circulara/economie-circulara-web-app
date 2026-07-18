import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata = { title: "Setari — Lateris Trace" };

/** Ecranul Setari (doar admin): white-label + acces la managementul utilizatorilor. */
export default async function SettingsPage() {
  await requireRole(["admin"]);
  const org = await getCurrentOrg();
  if (!org) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setari organizatie"
        description="Personalizeaza identitatea si gestioneaza utilizatorii."
        actions={
          <Button asChild variant="outline">
            <Link href="/setari/utilizatori">Utilizatori</Link>
          </Button>
        }
      />
      <SettingsForm org={org} />
    </div>
  );
}
