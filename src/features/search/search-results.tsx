import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { SearchResultGroup } from "./types";

export interface SearchResultsProps {
  query: string;
  groups: SearchResultGroup[];
}

/** Randare pura a rezultatelor grupate pe tip, cu link catre fiecare detaliu. */
export function SearchResults({ query, groups }: SearchResultsProps) {
  if (!query) {
    return (
      <EmptyState
        icon={<Search />}
        title="Introdu un termen de căutare"
        description="Caută comenzi, clienți, loturi, produse sau certificate."
      />
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Search />}
        title={`Niciun rezultat pentru „${query}”`}
        description="Încearcă alți termeni sau verifică ortografia."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.type} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {group.results.map((result) => (
              <li key={`${result.type}-${result.id}`}>
                <Link
                  href={result.href}
                  className="flex flex-col gap-0.5 px-4 py-3 text-sm transition-colors hover:bg-accent-soft"
                >
                  <span className="font-medium">{result.label}</span>
                  {result.sublabel ? (
                    <span className="text-xs text-muted-foreground">{result.sublabel}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
