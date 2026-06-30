import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/features/auth/session";
import { ROLE_LABELS } from "@/features/auth/roles";
import { listOrgUsers } from "@/features/settings/queries";
import { InviteStaffForm } from "@/features/settings/invite-staff-form";

export const metadata = { title: "Utilizatori — Lateris Trace" };

export default async function UsersPage() {
  await requireRole(["admin"]);
  const users = await listOrgUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizatori"
        breadcrumbs={[{ label: "Setari", href: "/setari" }, { label: "Utilizatori" }]}
        description="Invita operatori si administratori in organizatie."
        actions={
          <Button asChild variant="outline">
            <Link href="/setari">Inapoi la setari</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Invita un membru</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteStaffForm />
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.fullName ?? "—"}</TableCell>
              <TableCell>{u.email ?? "—"}</TableCell>
              <TableCell>{ROLE_LABELS[u.role]}</TableCell>
              <TableCell>
                <Badge variant={u.status === "active" ? "ok" : "neutral"}>
                  {u.status === "active" ? "Activ" : "Suspendat"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
