import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/features/auth/session";
import {
  currentPrices,
  DEFAULT_PRICE_MODEL,
  describeLimitChange,
  formatUsd,
  ORG_CREDIT_STATE_LABELS,
  ORG_CREDIT_STATE_ORDER,
  orgCreditStatus,
  type OrgCreditState,
} from "@/features/platform/ai-pricing";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  CreditSettingsForm,
  GrantCreditsForm,
  OrganizationAiLimitsForm,
} from "@/features/platform/ai-limits-forms";
import {
  getAiPlatformSettings,
  listModelPrices,
  listOrganizationAiLimits,
  usageSummary,
  type UsageTotals,
} from "@/features/platform/ai-usage-queries";
import { ModelPriceForm } from "@/features/platform/model-price-form";

export const metadata = { title: "Consum AI - Platforma Lot cu Lot" };

const number = new Intl.NumberFormat("ro-RO");

const STATE_BADGE: Record<OrgCreditState, BadgeVariant> = {
  blocked: "danger",
  warning: "warn",
  disabled: "neutral",
  ok: "ok",
  unlimited: "info",
};

function cacheRate(totals: UsageTotals): string {
  const input = totals.inputCacheHit + totals.inputCacheMiss;
  return input ? `${Math.round((totals.inputCacheHit / input) * 100)}%` : "-";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Consumul AI al platformei + preturile modelelor (docs/plans/asistent-consum-real.md,
 * etapa 1). Costurile sunt calculate LA INREGISTRARE cu pretul valabil atunci
 * (`assistant_record_usage`, migrarea 0037) - un pret nou se aplica doar de acum incolo.
 */
export default async function PlatformAiPage() {
  await requireRole(["super_admin"]);
  const [prices, usage, settings, organizations] = await Promise.all([
    listModelPrices(),
    usageSummary(30),
    getAiPlatformSettings(),
    listOrganizationAiLimits(),
  ]);
  const current = currentPrices(prices);
  const organizationsByState = organizations
    .map((organization) => ({
      organization,
      status: orgCreditStatus({
        enabled: organization.enabled,
        monthlyBase: organization.monthlyCredits,
        monthlyBonus: organization.bonusCredits,
        usedCredits: organization.usedCredits,
      }),
    }))
    .sort(
      (a, b) =>
        ORG_CREDIT_STATE_ORDER[a.status.state] - ORG_CREDIT_STATE_ORDER[b.status.state] ||
        (b.status.percent ?? 0) - (a.status.percent ?? 0),
    );
  const unpriced = usage.byModel.filter((row) => row.defaultPriceRequests > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consum AI"
        description="Costul real al asistentului, pe organizații și pe modele (ultimele 30 de zile), și prețurile folosite la calcul."
        actions={
          <Link href="/platform" className="text-sm text-primary underline underline-offset-4">
            ← Organizații
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Cost total", formatUsd(usage.total.costMicros)],
          ["Apeluri de model", number.format(usage.total.requests)],
          ["Tokeni din cache", cacheRate(usage.total)],
          ["Output", `${number.format(usage.total.output)} tokeni`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {unpriced.length ? (
        <p className="rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-sm text-warn">
          Modele folosite fără preț propriu (taxate cu prețul implicit „*”):{" "}
          <strong>{unpriced.map((row) => row.model).join(", ")}</strong>. Adaugă-le prețul mai jos.
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pe organizații</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organizație</TableHead>
              <TableHead className="text-right">Mesaje</TableHead>
              <TableHead className="text-right">Apeluri</TableHead>
              <TableHead className="text-right">Cache</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Cost / mesaj</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.byOrganization.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Niciun consum înregistrat încă.
                </TableCell>
              </TableRow>
            ) : (
              usage.byOrganization.map((row) => (
                <TableRow key={row.organizationId ?? "none"}>
                  <TableCell>{row.organizationName}</TableCell>
                  <TableCell className="text-right">{number.format(row.messages)}</TableCell>
                  <TableCell className="text-right">{number.format(row.requests)}</TableCell>
                  <TableCell className="text-right">{cacheRate(row)}</TableCell>
                  <TableCell className="text-right">{formatUsd(row.costMicros)}</TableCell>
                  <TableCell className="text-right">
                    {row.messages ? formatUsd(Math.round(row.costMicros / row.messages)) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pe modele</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Apeluri</TableHead>
              <TableHead className="text-right">Input nou</TableHead>
              <TableHead className="text-right">Input din cache</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Cost / apel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.byModel.map((row) => (
              <TableRow key={row.model}>
                <TableCell>{row.model}</TableCell>
                <TableCell className="text-right">{number.format(row.requests)}</TableCell>
                <TableCell className="text-right">{number.format(row.inputCacheMiss)}</TableCell>
                <TableCell className="text-right">{number.format(row.inputCacheHit)}</TableCell>
                <TableCell className="text-right">{number.format(row.output)}</TableCell>
                <TableCell className="text-right">{formatUsd(row.costMicros)}</TableCell>
                <TableCell className="text-right">
                  {row.requests ? formatUsd(Math.round(row.costMicros / row.requests)) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Credite AI</h2>
          <p className="text-xs text-muted-foreground">
            Utilizatorii văd consumul în credite, calculate din costul real al fiecărui răspuns.
            Valoarea curentă: 1 credit = {formatUsd(settings.creditMicros)}.
          </p>
          <CreditSettingsForm
            creditMicros={settings.creditMicros}
            turnCreditLimit={settings.turnCreditLimit}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Credite pe organizații - luna aceasta</h2>
        <p className="text-xs text-muted-foreground">
          Bugetul lunar e comun pentru organizație (0 = nelimitat); „% pe zi” limitează cât poate
          folosi un singur utilizator într-o zi. Creditele extra se adaugă doar pentru luna curentă
          și expiră la sfârșitul ei. Orice modificare rămâne în jurnal. Organizațiile cu probleme
          apar primele.
        </p>
        {organizationsByState.map(({ organization, status }) => (
          <Card key={organization.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{organization.name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span>
                    {number.format(organization.usedCredits)}
                    {status.limit > 0 ? ` / ${number.format(status.limit)}` : ""} credite
                    {status.percent !== null ? ` (${status.percent}%)` : ""}
                  </span>
                  <Badge variant={STATE_BADGE[status.state]}>
                    {ORG_CREDIT_STATE_LABELS[status.state]}
                  </Badge>
                </div>
              </div>
              {status.limit > 0 ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={
                      status.state === "blocked"
                        ? "h-full bg-danger"
                        : status.state === "warning"
                          ? "h-full bg-warn"
                          : "h-full bg-primary"
                    }
                    style={{ width: `${Math.min(status.percent ?? 0, 100)}%` }}
                  />
                </div>
              ) : null}
              {organization.bonusCredits > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Buget {number.format(organization.monthlyCredits)} +{" "}
                  {number.format(organization.bonusCredits)} credite extra luna aceasta.
                </p>
              ) : null}
              <OrganizationAiLimitsForm organization={organization} />
              {organization.monthlyCredits > 0 ? (
                <GrantCreditsForm organizationId={organization.id} />
              ) : null}
              {organization.changes.length ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Jurnal ({organization.changes.length} recente)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {organization.changes.map((change) => (
                      <li key={change.id}>
                        <span className="text-muted-foreground">
                          {formatDate(change.createdAt)} · {change.changedBy ?? "sistem"}:
                        </span>{" "}
                        {describeLimitChange(change)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Prețuri (USD / 1M tokeni)</h2>
        <p className="text-xs text-muted-foreground">
          Un preț nou adaugă o versiune; cele vechi rămân în istoric, iar costurile deja
          înregistrate nu se recalculează. „{DEFAULT_PRICE_MODEL}” e prețul implicit pentru modelele
          fără preț propriu.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Input din cache</TableHead>
              <TableHead className="text-right">Input nou</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead>Valabil de la</TableHead>
              <TableHead>Notă</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => {
              const active = current.get(price.model)?.id === price.id;
              return (
                <TableRow key={price.id} className={active ? "" : "text-muted-foreground"}>
                  <TableCell>
                    {price.model}
                    {active ? " (curent)" : ""}
                  </TableCell>
                  <TableCell className="text-right">{price.inputCacheHitPerM}</TableCell>
                  <TableCell className="text-right">{price.inputCacheMissPerM}</TableCell>
                  <TableCell className="text-right">{price.outputPerM}</TableCell>
                  <TableCell>{formatDate(price.validFrom)}</TableCell>
                  <TableCell>{price.note ?? ""}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Preț nou</h2>
          <ModelPriceForm />
        </CardContent>
      </Card>
    </div>
  );
}
