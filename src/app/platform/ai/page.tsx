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
import { currentPrices, DEFAULT_PRICE_MODEL, formatUsd } from "@/features/platform/ai-pricing";
import { CreditSettingsForm, OrganizationAiLimitsForm } from "@/features/platform/ai-limits-forms";
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

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-sm font-semibold">Limite pe organizație</h2>
          <p className="text-xs text-muted-foreground">
            Bugetul lunar e comun pentru organizație (0 = nelimitat); „% pe zi” limitează cât poate
            folosi un singur utilizator într-o zi din acest buget (0 = fără plafon zilnic).
          </p>
          {organizations.map((organization) => (
            <OrganizationAiLimitsForm key={organization.id} organization={organization} />
          ))}
        </CardContent>
      </Card>

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
