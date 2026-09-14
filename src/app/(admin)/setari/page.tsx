import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata = { title: "Setari - Lot cu Lot" };

/**
 * Ecranul Setari (doar admin): white-label + acces la managementul utilizatorilor
 * si la punctele de plecare (Task X7 - planificarea rutelor de livrare).
 */
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
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/setari/statii">Puncte de plecare</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/setari/utilizatori">Utilizatori</Link>
            </Button>
          </div>
        }
      />
      <SettingsForm org={org} />
    </div>
  );
}
