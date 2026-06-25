"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Boxes, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/components/layout/nav-config";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OrderRow = {
  id: string;
  client: string;
  produs: string;
  livrare: string;
  status: string;
};

const orders: OrderRow[] = [
  {
    id: "CMD-2043",
    client: "Construcții Apex SRL",
    produs: "Cărămidă eco",
    livrare: "2026-07-02",
    status: "trimisa",
  },
  {
    id: "CMD-2031",
    client: "Domus Renova SRL",
    produs: "Pavaj reciclat 20×20",
    livrare: "2026-06-28",
    status: "acceptata",
  },
  {
    id: "CMD-2018",
    client: "Verde Habitat SA",
    produs: "Agregat fin 0-8",
    livrare: "2026-06-20",
    status: "livrata",
  },
  {
    id: "CMD-1999",
    client: "EcoBuild Partener",
    produs: "Balast reciclat",
    livrare: "2026-06-15",
    status: "inchisa",
  },
  {
    id: "CMD-1990",
    client: "Ceramheld SRL",
    produs: "Cărămidă eco portantă",
    livrare: "—",
    status: "anulata",
  },
];

const columns: ColumnDef<OrderRow>[] = [
  { accessorKey: "id", header: "Comandă" },
  { accessorKey: "client", header: "Client" },
  { accessorKey: "produs", header: "Produs" },
  { accessorKey: "livrare", header: "Livrare" },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge group="order" status={row.original.status} />,
  },
];

export default function ShowcasePage() {
  return (
    <AppShell orgName="Lateris Demo" items={navForRole("admin")}>
      <PageHeader
        title="Design system"
        breadcrumbs={[{ label: "Lateris Trace" }, { label: "Showcase" }]}
        description="Componente reutilizabile si tema vizuala (T0.2)."
        actions={
          <Button>
            <Plus /> Acțiune
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Butoane</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statusuri</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["trimisa", "acceptata", "livrata", "inchisa", "anulata"].map((s) => (
            <StatusBadge key={s} group="order" status={s} />
          ))}
          {["achizitie", "productie", "reciclare", "retur", "ajustare"].map((s) => (
            <StatusBadge key={s} group="provenance" status={s} />
          ))}
          <Badge variant="outline">outline</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formular</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <FormField label="Denumire lot" required hint="Cod intern al lotului">
            {(id) => <Input id={id} placeholder="LOT-3360" />}
          </FormField>
          <FormField label="Cantitate" error="Valoare obligatorie">
            {(id) => <Input id={id} type="number" placeholder="0" />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabel comenzi (sortabil, paginat)</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={orders} pageSize={5} />
        </CardContent>
      </Card>

      <EmptyState
        icon={<Boxes />}
        title="Niciun lot în stoc"
        description="Adaugă primul lot pentru a începe trasabilitatea."
        action={
          <Button variant="outline">
            <Plus /> Adaugă lot
          </Button>
        }
      />
    </AppShell>
  );
}
