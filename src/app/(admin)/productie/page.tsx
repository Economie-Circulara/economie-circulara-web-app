import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listProcesses } from "@/features/production/queries";
import { ProcessesTable } from "@/features/production/processes-table";

export const metadata = { title: "Producție — Lateris Trace" };

/** Ecranul Producție — istoricul proceselor de fabricație/reciclare/recondiționare. */
export default async function ProductiePage() {
  await requireRole(["admin", "operator"]);

  const processes = await listProcesses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Producție"
        description="Procese de fabricație, reciclare și recondiționare — consum FIFO și trasabilitate."
        actions={
          <Button asChild>
            <Link href="/productie/nou">+ Pornește proces</Link>
          </Button>
        }
      />

      <ProcessesTable processes={processes} />
    </div>
  );
}
