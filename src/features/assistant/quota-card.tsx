import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuotaStatus } from "./types";

/**
 * Consumul, aratat explicit. Scopul e dublu: utilizatorul sa stie cat i-a mai ramas,
 * si sa fie clar ca feature-ul e inclus limitat - extinderea e discutie comerciala.
 */
export function QuotaCard({ quota, className }: { quota: QuotaStatus; className?: string }) {
  const unlimited = quota.monthlyLimit === 0;
  const remaining = unlimited ? null : Math.max(quota.monthlyLimit - quota.monthlyUsed, 0);
  const percent = unlimited
    ? 0
    : Math.min(Math.round((quota.monthlyUsed / Math.max(quota.monthlyLimit, 1)) * 100), 100);
  const low = remaining !== null && remaining <= Math.max(quota.monthlyLimit * 0.1, 5);

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Mesaje incluse luna aceasta
          </p>
          <p className="text-sm font-semibold">
            {unlimited ? "Nelimitat" : `${quota.monthlyUsed} / ${quota.monthlyLimit}`}
          </p>
        </div>

        {unlimited ? null : (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full bg-primary", low && "bg-warn")}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {quota.dailyLimit > 0
            ? `Astăzi ai folosit ${quota.dailyUsed} din ${quota.dailyLimit} mesaje.`
            : `Astăzi ai folosit ${quota.dailyUsed} mesaje.`}
        </p>

        <p className="text-xs text-muted-foreground">
          Asistentul este inclus în plan într-o limită lunară, pentru că fiecare răspuns costă. Dacă
          aveți nevoie de mai mult, extinderea se poate contracta separat.
        </p>
      </CardContent>
    </Card>
  );
}
