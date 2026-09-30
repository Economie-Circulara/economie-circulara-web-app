import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSISTANT_TOOLS } from "@/features/assistant/tools/registry";
import { ROLE_LABELS } from "@/features/auth/roles";
import { requireRole } from "@/features/auth/session";
import { formatUsd } from "@/features/platform/ai-pricing";
import {
  confirmationRate,
  INSIGHT_PERIODS,
  parseInsightDays,
  USAGE_SIGNAL_HINTS,
  USAGE_SIGNAL_LABELS,
  usageInsights,
  type ToolCounts,
  type ToolKind,
  type UsageSignal,
} from "@/features/platform/ai-usage-insights";
import { cn } from "@/lib/utils";

export const metadata = { title: "Utilizare asistent AI - Platforma Lot cu Lot" };

const number = new Intl.NumberFormat("ro-RO");

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })
    : "-";
}

function rate(counts: ToolCounts): string {
  const value = confirmationRate(counts);
  return value === null ? "-" : `${value}%`;
}

/** „confirmate / respinse / esuate / fara raspuns” ca text compact. */
function outcome(counts: { confirmed: number; rejected: number; failed: number; pending: number }) {
  return `${counts.confirmed} / ${counts.rejected} / ${counts.failed} / ${counts.pending}`;
}

const TOOL_KINDS = new Map<string, ToolKind>(ASSISTANT_TOOLS.map((tool) => [tool.name, tool.kind]));

const SIGNALS = Object.keys(USAGE_SIGNAL_LABELS) as UsageSignal[];

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Cum folosesc organizatiile asistentul - DOAR contoare, fara continutul conversatiilor
 * (docs/plans/asistent-utilizare-super-admin.md, RPC-urile din migrarea 0051).
 */
export default async function PlatformAiUsagePage({ searchParams }: PageProps) {
  await requireRole(["super_admin"]);
  const days = parseInsightDays((await searchParams)?.zile);
  const insights = await usageInsights(days, TOOL_KINDS);
  const { total } = insights;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizare asistent AI"
        description="Cine folosește asistentul și cum: mesaje, citiri de date și soarta acțiunilor propuse. Conținutul conversațiilor rămâne privat - aici apar doar numere."
        actions={
          <Link href="/platform/ai" className="text-sm text-primary underline underline-offset-4">
            ← Consum AI
          </Link>
        }
      />

      <nav className="flex gap-2 text-sm" aria-label="Perioadă">
        {INSIGHT_PERIODS.map((period) => (
          <Link
            key={period}
            href={`/platform/ai/utilizare?zile=${period}`}
            aria-current={period === days ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1",
              period === days ? "border-primary bg-primary text-primary-foreground" : "",
            )}
          >
            {period} zile
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["Utilizatori activi", number.format(total.activeUsers)],
          ["Conversații", number.format(total.conversations)],
          ["Mesaje trimise", number.format(total.messages)],
          ["Acțiuni propuse", number.format(total.proposals)],
          ["Rata de confirmare", rate(total)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Acțiunile sunt propuneri de scriere (client, comandă, rețetă...) pe care utilizatorul le
        confirmă sau le respinge; coloana „Rezultat” le arată ca confirmate / respinse / eșuate /
        fără răspuns. Citirile sunt consultări de date (stoc, comenzi...), fără efecte.
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pe organizații</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizație</TableHead>
                <TableHead className="text-right">Utilizatori</TableHead>
                <TableHead className="text-right">Conversații</TableHead>
                <TableHead className="text-right">Mesaje</TableHead>
                <TableHead className="text-right">Citiri</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
                <TableHead className="text-right">Rezultat</TableHead>
                <TableHead className="text-right">Confirmare</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">De urmărit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.byOrganization.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    Nicio activitate în perioada aleasă.
                  </TableCell>
                </TableRow>
              ) : (
                insights.byOrganization.map((row) => (
                  <TableRow key={row.organizationId ?? "none"}>
                    <TableCell>{row.organizationName}</TableCell>
                    <TableCell className="text-right">{number.format(row.activeUsers)}</TableCell>
                    <TableCell className="text-right">{number.format(row.conversations)}</TableCell>
                    <TableCell className="text-right">{number.format(row.messages)}</TableCell>
                    <TableCell className="text-right">{number.format(row.reads)}</TableCell>
                    <TableCell className="text-right">{number.format(row.proposals)}</TableCell>
                    <TableCell className="text-right">{outcome(row)}</TableCell>
                    <TableCell className="text-right">{rate(row)}</TableCell>
                    <TableCell className="text-right">{formatUsd(row.costMicros)}</TableCell>
                    <TableCell className="text-right">
                      {row.flaggedUsers ? (
                        <Badge variant="warn">{row.flaggedUsers} utilizatori</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pe utilizatori</h2>
        <p className="text-xs text-muted-foreground">
          Utilizatorii cu semnale apar primii. Semnalele sunt euristici, nu verdicte:
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {SIGNALS.map((signal) => (
            <li key={signal}>
              <strong>{USAGE_SIGNAL_LABELS[signal]}</strong>: {USAGE_SIGNAL_HINTS[signal]}
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilizator</TableHead>
                <TableHead>Organizație</TableHead>
                <TableHead className="text-right">Conversații</TableHead>
                <TableHead className="text-right">Mesaje</TableHead>
                <TableHead className="text-right">Zile active</TableHead>
                <TableHead className="text-right">Citiri</TableHead>
                <TableHead className="text-right">Rezultat acțiuni</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Ultima activitate</TableHead>
                <TableHead>Semnale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.byUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    Nicio activitate în perioada aleasă.
                  </TableCell>
                </TableRow>
              ) : (
                insights.byUser.map((row) => (
                  <TableRow key={`${row.organizationId ?? ""}:${row.userId}`}>
                    <TableCell>
                      {row.email}
                      {row.role ? (
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_LABELS[row.role]}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.organizationName}</TableCell>
                    <TableCell className="text-right">{number.format(row.conversations)}</TableCell>
                    <TableCell className="text-right">{number.format(row.messages)}</TableCell>
                    <TableCell className="text-right">{number.format(row.activeDays)}</TableCell>
                    <TableCell className="text-right">{number.format(row.reads)}</TableCell>
                    <TableCell className="text-right">{outcome(row)}</TableCell>
                    <TableCell className="text-right">{formatUsd(row.costMicros)}</TableCell>
                    <TableCell>{formatDate(row.lastActiveAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.signals.map((signal) => (
                          <Badge key={signal} variant="warn" title={USAGE_SIGNAL_HINTS[signal]}>
                            {USAGE_SIGNAL_LABELS[signal]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pe funcții ale asistentului</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcție</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="text-right">Apeluri</TableHead>
                <TableHead className="text-right">
                  Reușite / respinse / eșuate / fără răspuns
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.byTool.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nicio funcție folosită în perioada aleasă.
                  </TableCell>
                </TableRow>
              ) : (
                insights.byTool.map((row) => (
                  <TableRow key={row.tool}>
                    <TableCell className="font-mono text-xs">{row.tool}</TableCell>
                    <TableCell>
                      {row.kind === "write"
                        ? "Acțiune"
                        : row.kind === "read"
                          ? "Citire"
                          : "Retrasă"}
                    </TableCell>
                    <TableCell className="text-right">{number.format(row.calls)}</TableCell>
                    <TableCell className="text-right">{outcome(row)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
