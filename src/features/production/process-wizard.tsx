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
 * Wizard-ul de pornire proces (/productie/nou) - doua sub-fluxuri, ca in mockup
 * (docs/design/Lateris_Trace.dc.html): 4a "Output fix" si 4b "Output variabil".
 *
 * Tab-ul NU mai decide semantica rețetei (migrarea 0028). Fiecare formular citeste
 * `recipes.direction` al rețetei efectiv alese si, daca directia nu se potriveste
 * cu fluxul din tab, refuza sa calculeze si ofera un buton care deschide acelasi
 * item in fluxul corect (starea selectiei traieste aici, ca sa poata fi "mutata"
 * intre tab-uri). Inainte, o rețetă de descompunere deschisa in tab-ul "Output fix"
 * calcula tacit numere inversate - bug-ul "graficul arata invers".
 */
export function ProcessWizard({ recipes, inputItems }: ProcessWizardProps) {
  const [tab, setTab] = useState<Tab>("fix");
  const [fixedItemId, setFixedItemId] = useState(
    () => recipes.find((r) => r.direction === "compunere")?.itemId ?? recipes[0]?.itemId ?? "",
  );
  const [variableItemId, setVariableItemId] = useState(() => {
    const decomposable = recipes.find((r) => r.direction === "descompunere");
    const match = decomposable
      ? inputItems.find((item) => item.id === decomposable.itemId)
      : undefined;
    return match?.id ?? inputItems[0]?.id ?? "";
  });

  function openInVariableFlow(itemId: string) {
    setVariableItemId(itemId);
    setTab("var");
  }

  function openInFixedFlow(itemId: string) {
    setFixedItemId(itemId);
    setTab("fix");
  }

  return (
    <div className="max-w-5xl">
      <div className="flex overflow-hidden rounded-t-lg border border-b-0 bg-card">
        <TabButton active={tab === "fix"} onClick={() => setTab("fix")}>
          <div className="font-semibold">Fabricație</div>
          <div className="text-xs text-muted-foreground">
            Rețete de producție · se folosesc întâi loturile cele mai vechi
          </div>
        </TabButton>
        <TabButton active={tab === "var"} onClick={() => setTab("var")}>
          <div className="font-semibold">Reciclare</div>
          <div className="text-xs text-muted-foreground">
            Rețete de reciclare · materiale rezultate ajustabile
          </div>
        </TabButton>
      </div>

      {tab === "fix" ? (
        <FixedOutputForm
          recipes={recipes}
          recipeItemId={fixedItemId}
          onRecipeItemIdChange={setFixedItemId}
          onOpenInVariableFlow={openInVariableFlow}
        />
      ) : (
        <VariableOutputForm
          inputItems={inputItems}
          inputItemId={variableItemId}
          onInputItemIdChange={setVariableItemId}
          onOpenInFixedFlow={openInFixedFlow}
        />
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
