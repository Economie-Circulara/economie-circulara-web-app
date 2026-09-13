import type { AppRole } from "@/components/layout/nav-config";

/**
 * Un document din `docs/manual/`, expus in aplicatie la `/ajutor/<slug>`.
 * Markdown-ul ramane sursa unica de adevar (se citeste si pe GitHub) - aici doar
 * mapam fisierul pe o ruta si pe rolurile care au voie sa-l vada.
 */
export interface ManualDoc {
  /** Segmentul de URL: `/ajutor/utilizare-admin-operator`. */
  slug: string;
  /** Numele fisierului din `docs/manual/`. */
  file: string;
  /** Titlul afisat in card si in PageHeader. */
  title: string;
  /** O propozitie pentru cardul din index. */
  description: string;
  /** Eticheta scurta de public-tinta ("Administrator / Operator"). */
  audience: string;
  roles: AppRole[];
}

const STAFF: AppRole[] = ["admin", "operator", "super_admin"];

export const MANUAL_DOCS: readonly ManualDoc[] = [
  {
    slug: "cuprins",
    file: "README.md",
    title: "Prezentare generală",
    description:
      "Cine ce citește, fluxul complet al platformei de la organizație până la certificatul de trasabilitate și stadiul funcționalităților.",
    audience: "Toți utilizatorii organizației",
    roles: STAFF,
  },
  {
    slug: "utilizare-admin-operator",
    file: "utilizare-admin-operator.md",
    title: "Manual admin / operator",
    description:
      "Ghid pas-cu-pas pentru activitatea zilnică: clienți, itemi și rețete, stoc, producție și reciclare, comenzi, retur, livrări, rapoarte, căutare.",
    audience: "Administrator / Operator",
    roles: STAFF,
  },
  {
    slug: "utilizare-client",
    file: "utilizare-client.md",
    title: "Manual portal client",
    description:
      "Ghid pas-cu-pas pentru portalul clientului: catalog și coș, plasarea și urmărirea comenzilor, retur, documente și certificate.",
    audience: "Client",
    // Staff-ul il vede si el, ca sa poata da suport unui client la telefon.
    roles: ["client", ...STAFF],
  },
  {
    slug: "ghid-administrare",
    file: "ghid-administrare.md",
    title: "Ghid de administrare",
    description:
      "Setările organizației (identitate, white-label, domeniu, email), managementul utilizatorilor, administrarea multi-organizație și operarea tehnică.",
    audience: "Administrator / Super-admin",
    roles: ["admin", "super_admin"],
  },
  {
    slug: "instruire",
    file: "instruire.md",
    title: "Plan de instruire",
    description:
      "Sesiunile de instruire pe rol (S1-S5): agendă, durată estimată, checklist de competențe și materiale necesare.",
    audience: "Responsabil cu instruirea",
    roles: ["admin", "super_admin"],
  },
];

/** Documentele pe care rolul dat are voie sa le citeasca, in ordinea din catalog. */
export function manualDocsForRole(role: AppRole): ManualDoc[] {
  return MANUAL_DOCS.filter((doc) => doc.roles.includes(role));
}

/**
 * Documentul cerut, daca rolul are voie la el. `null` si pentru slug inexistent,
 * si pentru slug interzis - apelantul raspunde identic (`notFound()`), ca sa nu
 * divulge existenta unui document pe care rolul nu-l poate citi.
 */
export function findManualDoc(slug: string, role: AppRole): ManualDoc | null {
  const doc = MANUAL_DOCS.find((item) => item.slug === slug);
  if (!doc) return null;
  return doc.roles.includes(role) ? doc : null;
}

/** `"utilizare-client.md"` -> `"utilizare-client"`. Folosit la rescrierea link-urilor. */
export function slugForFile(file: string): string | null {
  return MANUAL_DOCS.find((doc) => doc.file === file)?.slug ?? null;
}
