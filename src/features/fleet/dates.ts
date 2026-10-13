/** Data de azi in Romania (`YYYY-MM-DD`) - serverul Vercel ruleaza in UTC. */
export function todayInRomania(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
