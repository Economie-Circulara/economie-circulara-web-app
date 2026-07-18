import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { ClientTable } from "@/features/clients/client-table";
import { listClients } from "@/features/clients/queries";

export const metadata = { title: "Clienți — Lateris Trace" };

interface ClientiPageProps {
  searchParams: Promise<{ q?: string }>;
}

/** Ecranul Clienți — lista firmelor (doar staff), cu căutare după denumire/CUI. */
export default async function ClientiPage({ searchParams }: ClientiPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;
  const search = params.q?.trim() || undefined;

  const clients = await listClients({ search });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clienți"
        description="Firmele cumpărătoare (și, opțional, furnizoare) ale organizației."
        actions={
          <Button asChild>
            <Link href="/clienti/nou">+ Adaugă client</Link>
          </Button>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Căutare
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Denumire sau CUI..."
            className="w-64"
          />
        </div>
        <Button type="submit" variant="outline">
          Caută
        </Button>
        {search ? (
          <Button asChild variant="ghost">
            <Link href="/clienti">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <ClientTable clients={clients} />
    </div>
  );
}
