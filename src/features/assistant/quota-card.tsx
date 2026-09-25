import { InfoTip } from "@/components/info-tip";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuotaStatus } from "./types";

const number = new Intl.NumberFormat("ro-RO");

/**
 * Consumul asistentului, in CREDITE AI (docs/plans/asistent-consum-real.md, etapa 2).
 * Scopul e dublu: utilizatorul sa stie cat i-a mai ramas si de ce unele cereri consuma
 * mai mult - si sa fie clar ca feature-ul e inclus limitat (extinderea e comerciala).
 */
export function QuotaCard({ quota, className }: { quota: QuotaStatus; className?: string }) {
  const unlimited = quota.monthlyLimit === 0;
  const percent = unlimited
    ? 0
    : Math.min(Math.round((quota.monthlyUsed / Math.max(quota.monthlyLimit, 1)) * 100), 100);

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Credite AI luna aceasta
            <InfoTip label="Ce sunt creditele AI?">
              <span className="block">
                <strong>Creditele măsoară cât a lucrat asistentul</strong>, nu câte mesaje ai
                trimis. O întrebare simplă consumă puțin; o cerere cu mai mulți pași (ex. „fă o
                comandă cu 5 produse”) sau citirea unui document lung consumă mai mult, pentru că
                asistentul caută, verifică și citește mai mult.
              </span>
              <span className="block">
                Bugetul e <strong>comun pentru toată organizația</strong> și se reînnoiește pe 1 ale
                fiecărei luni.
                {quota.dailyPercent > 0
                  ? ` Ca să ajungă pentru toată echipa, fiecare persoană poate folosi pe zi cel mult ${quota.dailyPercent}% din el.`
                  : ""}
              </span>
              <span className="block">
                Dacă bugetul se termină în timp ce asistentul lucrează, răspunsul curent se termină
                normal; următorul mesaj așteaptă reînnoirea sau un plan extins.
              </span>
            </InfoTip>
          </p>
          <p className="text-sm font-semibold whitespace-nowrap">
            {unlimited
              ? "Nelimitat"
              : `${number.format(quota.monthlyUsed)} / ${number.format(quota.monthlyLimit)}`}
          </p>
        </div>

        {unlimited ? null : (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Credite AI folosite luna aceasta"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-full rounded-full bg-primary", quota.warning && "bg-warn")}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {!unlimited ? (
          <p className={cn("text-xs text-muted-foreground", quota.warning && "text-warn")}>
            {quota.warning
              ? `Organizația a folosit ${percent}% din credite. `
              : `${percent}% folosit. `}
            {quota.estimatedMessagesLeft !== null
              ? `Mai ajung pentru aproximativ ${number.format(quota.estimatedMessagesLeft)} ${quota.estimatedMessagesLeft === 1 ? "întrebare" : "întrebări"}, la consumul mediu de până acum.`
              : ""}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {quota.dailyLimit > 0
            ? `Astăzi ai folosit ${number.format(quota.dailyUsed)} din cele ${number.format(quota.dailyLimit)} credite ale tale pe zi.`
            : `Astăzi ai folosit ${number.format(quota.dailyUsed)} credite.`}
        </p>

        <p className="text-xs text-muted-foreground">
          Asistentul e inclus în plan într-un buget lunar, pentru că fiecare răspuns are un cost
          real. Dacă aveți nevoie de mai mult, extinderea se poate contracta separat.
        </p>
      </CardContent>
    </Card>
  );
}
