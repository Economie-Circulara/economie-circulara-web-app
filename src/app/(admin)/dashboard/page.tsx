import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Dashboard — Lateris Trace" };

/** Ecran admin/operator. Ecranele de business (comenzi, stoc, productie) vin in Wave 2. */
export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description="Privire de ansamblu asupra activitatii." />
      <p className="text-sm text-muted-foreground">
        Modulele de comenzi, stoc si productie se adauga in Wave 2.
      </p>
    </div>
  );
}
