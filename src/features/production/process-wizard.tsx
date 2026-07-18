"use client";

import { useState } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import type { RecipeListRow } from "@/features/recipes/types";
import type { ItemOption } from "@/features/items/types";
import { FixedOutputForm } from "./fixed-output-form";
import { VariableOutputForm } from "./variable-output-form";

export interface ProcessWizardProps {
  recipes: RecipeListRow[];
  inputItems: ItemOption[];
}

type Tab = "fix" | "var";

/**
 * Wizard-ul de pornire proces (/productie/nou) — doua sub-fluxuri, ca in mockup
 * (docs/design/Lateris_Trace.dc.html): 4a "Output fix" si 4b "Output variabil".
 */
export function ProcessWizard({ recipes, inputItems }: ProcessWizardProps) {
  const [tab, setTab] = useState<Tab>("fix");

  return (
    <div className="max-w-5xl">
      <div className="flex overflow-hidden rounded-t-lg border border-b-0 bg-card">
        <TabButton active={tab === "fix"} onClick={() => setTab("fix")}>
          <div className="font-semibold">Output fix — Fabricație</div>
          <div className="text-xs text-muted-foreground">
            Cărămizi, pavaje · consum FIFO automat
          </div>
        </TabButton>
        <TabButton active={tab === "var"} onClick={() => setTab("var")}>
          <div className="font-semibold">Output variabil — Reciclare</div>
          <div className="text-xs text-muted-foreground">
            Moloz, demolări · fracții reale ajustabile
          </div>
        </TabButton>
      </div>

      {tab === "fix" ? (
        <FixedOutputForm recipes={recipes} />
      ) : (
        <VariableOutputForm inputItems={inputItems} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 border-b-2 px-5 py-3 text-left text-sm transition-colors",
        active
          ? "border-accent bg-secondary/30"
          : "border-transparent text-muted-foreground hover:bg-secondary/20",
      )}
    >
      {children}
    </button>
  );
}
