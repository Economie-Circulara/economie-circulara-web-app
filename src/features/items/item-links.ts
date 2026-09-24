import type { ItemKind } from "./types";

/**
 * Ruta de detaliu a unui item, in functie de `kind` - itemii `service`
 * ("Abonamente" in UI) au ecran propriu (`/abonamente/[id]`), separat de
 * materialele fizice (`/itemi/[id]`). Orice link catre un item existent
 * (tabele, cautare globala, tool-uri asistent) trebuie sa treaca prin acest
 * helper, nu sa construiasca `/itemi/${id}` direct - altfel un link catre un
 * abonament duce la 404 (`/itemi/[id]` respinge itemii care nu sunt `physical`).
 */
export function itemHref(item: { id: string; kind: ItemKind }): string {
  return item.kind === "service" ? `/abonamente/${item.id}` : `/itemi/${item.id}`;
}

/** Lista in care apare un item, dupa `kind` - `/abonamente` sau `/itemi` (Materiale). */
export function itemListHref(kind: ItemKind): string {
  return kind === "service" ? "/abonamente" : "/itemi";
}
