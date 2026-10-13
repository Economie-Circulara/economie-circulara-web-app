import { Card, CardContent } from "@/components/ui/card";
import { formatAmount, formatDay, formatLiters } from "./labels";
import type { FuelSummary } from "./types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Totalurile alimentarilor (pagina vehiculului, jurnalul filtrat). */
export function FuelSummaryCards({ summary }: { summary: FuelSummary }) {
  const amountHint =
    summary.amountCount < summary.count
      ? `Din ${summary.amountCount} alimentări cu sumă completată`
      : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Alimentări" value={String(summary.count)} />
      <Stat label="Litri alimentați" value={formatLiters(summary.liters)} />
      <Stat label="Sumă plătită" value={formatAmount(summary.amount)} hint={amountHint} />
      <Stat
        label="Ultima alimentare"
        value={summary.lastFilledOn ? formatDay(summary.lastFilledOn) : "—"}
      />
    </div>
  );
}
