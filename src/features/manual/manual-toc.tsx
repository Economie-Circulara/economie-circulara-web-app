import { cn } from "@/lib/utils";
import type { TocEntry } from "./toc";

/** Cuprinsul unui document: lista de ancore h2/h3. Fara JS de client. */
export function ManualToc({ entries, className }: { entries: TocEntry[]; className?: string }) {
  if (entries.length === 0) return null;

  return (
    <nav aria-label="Cuprins" className={cn("text-sm", className)}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Cuprins
      </p>
      <ul className="space-y-1.5 border-l">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                "-ml-px block border-l border-transparent py-0.5 pl-3 text-muted-foreground hover:border-primary hover:text-foreground",
                entry.level === 3 && "pl-6 text-xs",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
