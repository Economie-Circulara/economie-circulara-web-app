import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CONSUMPTION_DEVIATION_ALERT_PERCENT,
  consumptionDeviationPercent,
  type OdometerStats,
} from "./calc";
import { formatConsumption } from "./labels";

function Stat({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Card className={cn(alert && "border-warn")}>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {hint ? (
          <p className={cn("text-xs", alert ? "text-warn" : "text-muted-foreground")}>{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Kilometrajul si consumul real ale unui vehicul (din alimentarile cu kilometraj),
 * comparat cu consumul declarat. Consumul real presupune plinul la fiecare alimentare.
 */
export function OdometerSummary({
  stats,
  declaredConsumption,
}: {
  stats: OdometerStats;
  declaredConsumption: number;
}) {
  const deviation =
    stats.realConsumption !== null
      ? consumptionDeviationPercent(stats.realConsumption, declaredConsumption)
      : null;
  const alert = deviation !== null && Math.abs(deviation) > CONSUMPTION_DEVIATION_ALERT_PERCENT;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Kilometraj curent"
        value={stats.currentKm !== null ? `${stats.currentKm.toLocaleString("ro-RO")} km` : "—"}
        hint={stats.currentKm === null ? "Apare după prima alimentare cu kilometraj." : undefined}
      />
      <Stat
        label="Km parcurși (între alimentări)"
        value={`${stats.kmDriven.toLocaleString("ro-RO")} km`}
      />
      <Stat
        label="Consum real"
        value={stats.realConsumption !== null ? formatConsumption(stats.realConsumption) : "—"}
        alert={alert}
        hint={
          deviation === null
            ? "Necesită cel puțin două alimentări cu kilometraj."
            : `Declarat ${formatConsumption(declaredConsumption)} (${deviation > 0 ? "+" : ""}${deviation}%)${alert ? " - abatere mare" : ""}. Presupune plinul la fiecare alimentare.`
        }
      />
    </div>
  );
}
