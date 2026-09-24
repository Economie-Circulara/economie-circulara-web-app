import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
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
import {
  deactivateUserAction,
  reactivateUserAction,
} from "@/features/settings/deactivation-actions";
import { deactivationError } from "@/features/settings/deactivation";
import { listAvailableClientsForInvite, listOrgUsers } from "@/features/settings/queries";
import { InviteStaffForm } from "@/features/settings/invite-staff-form";
import { InviteClientForm } from "@/features/settings/invite-client-form";

export const metadata = { title: "Utilizatori - Lot cu Lot" };

export default async function UsersPage() {
  const currentUser = await requireRole(["admin"]);
  const [users, availableClients] = await Promise.all([
    listOrgUsers(),
    listAvailableClientsForInvite(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizatori"
        breadcrumbs={[{ label: "Setari", href: "/setari" }, { label: "Utilizatori" }]}
        description="Invita operatori, administratori si clienti in organizatie. Conturile de staff pot fi dezactivate (nu sterse - raman autori in istoric)."
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

      <Card>
        <CardHeader>
          <CardTitle>Invita un client</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteClientForm clients={availableClients} />
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nume</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Firma</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.fullName ?? "-"}</TableCell>
              <TableCell>{u.email ?? "-"}</TableCell>
              <TableCell>{ROLE_LABELS[u.role]}</TableCell>
              <TableCell>{u.role === "client" ? (u.clientName ?? "-") : "-"}</TableCell>
              <TableCell>
                <Badge variant={u.status === "active" ? "ok" : "neutral"}>
                  {u.status === "active" ? "Activ" : "Dezactivat"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {/* Doar conturi de staff, niciodata propriul cont (migrarea 0035). */}
                {deactivationError(currentUser, {
                  id: u.id,
                  role: u.role,
                  organizationId: currentUser.organizationId,
                }) !== null ? null : u.status === "active" ? (
                  <ConfirmActionButton
                    triggerLabel="Dezactivează"
                    triggerSize="sm"
                    title={`Dezactivezi contul ${u.email ?? u.fullName ?? ""}?`}
                    description="Persoana nu se va mai putea loga în platformă. Contul nu se șterge: tot ce a făcut rămâne în istoric pe numele ei. Îl poți reactiva oricând."
                    confirmLabel="Da, dezactivează"
                    action={deactivateUserAction.bind(null, u.id)}
                  />
                ) : (
                  <ConfirmActionButton
                    triggerLabel="Reactivează"
                    triggerSize="sm"
                    title={`Reactivezi contul ${u.email ?? u.fullName ?? ""}?`}
                    description="Persoana se va putea loga din nou, cu același rol."
                    confirmLabel="Da, reactivează"
                    confirmVariant="default"
                    action={reactivateUserAction.bind(null, u.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
