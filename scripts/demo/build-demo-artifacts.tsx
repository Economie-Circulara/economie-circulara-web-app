/**
 * Generează fișierele demo care au nevoie de Storage (nu pot fi create din SQL):
 *   - certificatele de trasabilitate PDF pentru comenzile închise ale organizației demo,
 *     cu ACELAȘI cod ca aplicația (`buildTraceabilityGraph` + `CertificatePdfDocument`);
 *   - documente atașate (contracte, fișe tehnice, procese-verbale) - PDF-uri marcate
 *     vizibil ca demonstrative.
 *
 * NU se conectează la nicio bază de date și nu are nevoie de chei: citește exportul JSON
 * produs de `scripts/demo/export-demo-data.sql` și scrie în directorul de ieșire:
 *   storage/certificates/**  -> se urcă în bucketul `certificates`
 *   storage/documents/**     -> se urcă în bucketul `documents`
 *   artifacts.sql            -> rândurile `certificates` / `documents` (+ contorul)
 *
 * Rulare (din rădăcina repo-ului - fonturile PDF se rezolvă din `process.cwd()`):
 *   JITI_JSX=1 JITI_ALIAS="{\"@\":\"$PWD/src\"}" pnpm exec jiti scripts/demo/build-demo-artifacts.tsx <export.json> <out-dir>
 * Pașii compleți: supabase/demo/README.md.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as React from "react";
import { createElement } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CertificatePdfDocument } from "@/features/certificates/pdf";
import { buildTraceabilityGraph } from "@/features/certificates/traceability";
import {
  TRACEABILITY_SNAPSHOT_VERSION,
  type DeliveredLotLine,
  type RawLot,
  type RawProcess,
  type RawProcessInput,
  type RawProcessOutput,
  type TraceabilityRawData,
  type TraceabilitySnapshot,
  type TraceabilitySnapshotItem,
} from "@/features/certificates/types";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf/fonts";

interface Ref {
  id: string;
  number: string | null;
  at: string | null;
}

interface DemoExport {
  organization: {
    id: string;
    name: string;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;
  adminUserId: string;
  closedOrders: {
    id: string;
    number: string;
    closedAt: string;
    clientName: string;
    clientCui: string;
  }[];
  existingCertificates: number;
  consumptions: {
    orderId: string;
    lotId: string;
    itemId: string;
    itemTitle: string;
    unit: string;
    quantity: number;
  }[];
  lots: RawLot[];
  processes: RawProcess[];
  processOutputs: RawProcessOutput[];
  processInputs: RawProcessInput[];
  existingDocuments: number;
  clients: Record<string, { id: string; name: string; createdAt: string }>;
  items: Record<string, { id: string; createdAt: string }>;
  orderTargets: {
    firstClosed: Ref | null;
    warrantyOriginal: Ref | null;
    firstRental: Ref | null;
    largestDelivery: Ref | null;
  };
}

/** Acceptă atât JSON-ul brut (`{...}`), cât și ieșirea `supabase db query -o json`. */
function unwrapExport(raw: unknown): DemoExport {
  const value = raw as { rows?: { data: DemoExport }[]; data?: DemoExport };
  if (Array.isArray(value.rows)) return value.rows[0]!.data;
  if (value.data) return value.data;
  return raw as DemoExport;
}

// -----------------------------------------------------------------------------
// Certificate - aceeași traversare ca src/features/certificates/repository.ts, dar
// peste datele exportate (in memorie).
// -----------------------------------------------------------------------------

function rawDataForOrder(data: DemoExport, orderId: string): TraceabilityRawData {
  const byLot = new Map<string, DeliveredLotLine>();
  for (const row of data.consumptions.filter((c) => c.orderId === orderId)) {
    const qty = Math.abs(Number(row.quantity));
    const existing = byLot.get(row.lotId);
    if (existing) existing.quantity += qty;
    else
      byLot.set(row.lotId, {
        lotId: row.lotId,
        itemId: row.itemId,
        itemTitle: row.itemTitle,
        unit: row.unit,
        quantity: qty,
      });
  }
  const delivered = [...byLot.values()];

  const allLots = new Map(data.lots.map((lot) => [lot.id, lot]));
  const allProcesses = new Map(data.processes.map((p) => [p.id, p]));
  const outputs = new Map(
    data.processOutputs.map((o) => [o.lotId, { ...o, quantity: Number(o.quantity) }]),
  );

  const lots: Record<string, RawLot> = {};
  const processes: Record<string, RawProcess> = {};
  const outputByLot: Record<string, RawProcessOutput> = {};
  const inputsByProcess: Record<string, RawProcessInput[]> = {};

  const visited = new Set<string>();
  let frontier = [...new Set(delivered.map((line) => line.lotId))];
  while (frontier.length > 0) {
    const next = new Set<string>();
    for (const lotId of frontier) {
      if (visited.has(lotId)) continue;
      visited.add(lotId);
      const lot = allLots.get(lotId);
      if (lot) lots[lotId] = lot;
      const output = outputs.get(lotId);
      if (!output) continue;
      outputByLot[lotId] = output;
      if (processes[output.processId]) continue;
      const process = allProcesses.get(output.processId);
      if (process) processes[process.id] = process;
      const inputs = data.processInputs
        .filter((input) => input.processId === output.processId)
        .map((input) => ({ ...input, quantity: Number(input.quantity) }));
      inputsByProcess[output.processId] = inputs;
      inputs.forEach((input) => next.add(input.lotId));
    }
    frontier = [...next].filter((id) => !visited.has(id));
  }

  return { delivered, lots, processes, outputByLot, inputsByProcess };
}

function aggregateDeliveredItems(delivered: DeliveredLotLine[]): TraceabilitySnapshotItem[] {
  const byItem = new Map<string, TraceabilitySnapshotItem>();
  for (const line of delivered) {
    const existing = byItem.get(line.itemId);
    if (existing) existing.quantity += line.quantity;
    else
      byItem.set(line.itemId, {
        itemId: line.itemId,
        itemTitle: line.itemTitle,
        unit: line.unit,
        quantity: line.quantity,
      });
  }
  return [...byItem.values()];
}

// -----------------------------------------------------------------------------
// Documente demo
// -----------------------------------------------------------------------------

const docStyles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, padding: 48, color: "#1f2a24" },
  org: { fontSize: 9, color: "#5b6b62", marginBottom: 24 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#5b6b62", marginBottom: 20 },
  heading: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  paragraph: { lineHeight: 1.5, marginBottom: 6 },
  banner: {
    marginTop: 28,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d98e32",
    color: "#8a5a1a",
    fontSize: 8.5,
  },
});

interface DemoDocSpec {
  ownerType: "client" | "order" | "item";
  ownerId: string;
  fileName: string;
  title: string;
  description: string;
  createdAt: string;
  sections: [heading: string, paragraphs: string[]][];
}

function DemoDocument({ spec, orgName }: { spec: DemoDocSpec; orgName: string }) {
  const date = new Intl.DateTimeFormat("ro-RO").format(new Date(spec.createdAt));
  return (
    <Document title={spec.title}>
      <Page size="A4" style={docStyles.page}>
        <Text style={docStyles.org}>{orgName} · Str. Depozitelor nr. 7, Chitila, Ilfov</Text>
        <Text style={docStyles.title}>{spec.title}</Text>
        <Text style={docStyles.meta}>Data: {date}</Text>
        {spec.sections.map(([heading, paragraphs]) => (
          <View key={heading} wrap={false}>
            <Text style={docStyles.heading}>{heading}</Text>
            {paragraphs.map((paragraph, index) => (
              <Text key={index} style={docStyles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
        <Text style={docStyles.banner}>
          DOCUMENT DEMONSTRATIV - generat pentru prezentarea platformei Lot cu Lot. Datele sunt
          fictive și documentul nu are valoare juridică.
        </Text>
      </Page>
    </Document>
  );
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .slice(-150)
      .replace(/[^a-zA-Z0-9._-]/g, "_") || "fisier"
  );
}

function documentSpecs(data: DemoExport): DemoDocSpec[] {
  const specs: DemoDocSpec[] = [];
  const client = (cui: string) => {
    const found = data.clients[cui];
    if (!found) throw new Error(`Clientul demo cu CUI ${cui} lipsește din export.`);
    return found;
  };
  const item = (title: string) => {
    const found = data.items[title];
    if (!found) throw new Error(`Itemul demo "${title}" lipsește din export.`);
    return found;
  };
  const contract = (
    cui: string,
    fileName: string,
    title: string,
    object: string,
    extra: [string, string[]][] = [],
  ) => {
    const c = client(cui);
    specs.push({
      ownerType: "client",
      ownerId: c.id,
      fileName,
      title,
      description: title,
      createdAt: addDays(c.createdAt, 2),
      sections: [
        [
          "Părțile",
          [
            `${data.organization!.name}, în calitate de furnizor, și ${c.name} (CUI ${cui}), în calitate de beneficiar.`,
          ],
        ],
        ["Obiectul contractului", [object]],
        ...extra,
        [
          "Trasabilitate",
          [
            "Pentru fiecare comandă închisă, furnizorul emite un certificat de trasabilitate care indică loturile livrate, procesele de transformare și ponderea materialelor secundare (reciclate, recondiționate, returnate).",
          ],
        ],
      ],
    });
  };

  contract(
    "RO31845920",
    "Contract-cadru-vanzare-14-2026.pdf",
    "Contract-cadru de vânzare nr. 14/2026",
    "Livrarea eșalonată de pavele, borduri, blocuri de zidărie și beton cu agregat reciclat, pe baza comenzilor transmise prin platformă sau telefonic.",
    [["Durată", ["12 luni de la semnare, cu prelungire automată."]]],
  );
  contract(
    "RO40217735",
    "Contract-furnizare-21-2026.pdf",
    "Contract de furnizare nr. 21/2026",
    "Furnizarea materialelor pentru ansamblul Arcada Sud, etapa II: blocuri de zidărie eco, pavele și borduri.",
  );
  contract(
    "RO14926011",
    "Contract-furnizare-agregate-9-2026.pdf",
    "Contract de furnizare agregate nr. 9/2026",
    "Furnizarea de agregate reciclate 16-31,5 mm, 4-16 mm și balast reciclat pentru lucrările de pe DJ 606.",
    [
      [
        "Retur material neutilizat",
        [
          "Materialul nepus în operă poate fi returnat în maximum 30 de zile de la livrare; se reintroduce în stoc după inspecție.",
        ],
      ],
    ],
  );
  contract(
    "4351820",
    "Contract-achizitie-publica-118-2026.pdf",
    "Contract de achiziție publică nr. 118/2026",
    "Furnizarea de pavele eco și borduri pentru modernizarea trotuarelor din zona centrală, în trei tranșe.",
  );
  contract(
    "RO42775310",
    "Contract-inchiriere-echipamente-31-2026.pdf",
    "Contract de închiriere echipamente nr. 31/2026",
    "Închirierea de panouri de cofraj metalic și containere pentru moloz, pe perioade determinate.",
    [
      [
        "Retur și recondiționare",
        [
          "Echipamentele se returnează la data prevăzută în comandă. La retur se inspectează și se recondiționează; panourile deteriorate iremediabil se facturează beneficiarului.",
        ],
      ],
    ],
  );
  contract(
    "RO38809126",
    "Contract-preluare-deseuri-3-2026.pdf",
    "Contract de preluare deșeuri din construcții nr. 3/2026",
    "Preluarea molozului din demolări (cod deșeu 17 01 01) de la punctele de lucru ale furnizorului, cu aviz de însoțire pentru fiecare transport.",
  );

  const technical = (title: string, fileName: string, docTitle: string, lines: string[]) => {
    const it = item(title);
    specs.push({
      ownerType: "item",
      ownerId: it.id,
      fileName,
      title: docTitle,
      description: docTitle,
      createdAt: addDays(it.createdAt, 1),
      sections: [
        ["Produs", [title]],
        ["Caracteristici", lines],
      ],
    });
  };
  technical(
    "Agregat reciclat 0-4 mm",
    "Fisa-tehnica-agregat-0-4.pdf",
    "Fișă tehnică - Agregat reciclat 0-4 mm",
    [
      "Granulometrie 0/4 conform SR EN 933-1; conținut de părți fine ≤ 10%.",
      "Utilizare: betoane de clasă ≤ C25/30, mortare, pavele vibropresate.",
    ],
  );
  technical(
    "Agregat reciclat 16-31,5 mm",
    "Fisa-tehnica-agregat-16-31.pdf",
    "Fișă tehnică - Agregat reciclat 16-31,5 mm",
    [
      "Categorie Gc 85/20 conform SR EN 13242.",
      "Utilizare: straturi de fundație, drumuri de șantier, platforme.",
    ],
  );
  technical(
    "Pavele eco 20×10×6 cm",
    "Declaratie-conformitate-pavele-eco.pdf",
    "Declarație de conformitate - Pavele eco 20×10×6 cm",
    [
      "Rezistență la rupere la despicare ≥ 3,6 MPa; absorbție de apă ≤ 6%.",
      "Minimum 45% agregat reciclat în compoziție (conform rețetei de fabricație).",
    ],
  );
  technical(
    "Beton C16/20 cu agregat reciclat",
    "Buletin-incercari-beton-C16-20.pdf",
    "Buletin de încercări - rezistență la compresiune la 28 de zile",
    ["Epruvete cubice 150 mm: medie 24,8 MPa (6 epruvete). Rezultat: conform clasei C16/20."],
  );
  technical(
    "Panou cofraj metalic modular 2,4×1,2 m",
    "Instructiuni-utilizare-reconditionare-cofraj.pdf",
    "Instrucțiuni de utilizare și recondiționare - panou cofraj",
    [
      "La retur: curățare de beton, verificarea planeității, îndreptare, vopsire anticorozivă.",
      "Panourile cu deformări peste 3 mm se casează și se predau la reciclare.",
    ],
  );

  const orderDoc = (
    target: Ref | null,
    fileName: string,
    docTitle: string,
    lines: string[],
    offsetDays = 0,
  ) => {
    if (!target) return;
    specs.push({
      ownerType: "order",
      ownerId: target.id,
      fileName,
      title: `${docTitle} - ${target.number ?? ""}`.trim(),
      description: docTitle,
      createdAt: addDays(target.at ?? new Date().toISOString(), offsetDays),
      sections: [["Constatări", lines]],
    });
  };
  const t = data.orderTargets;
  orderDoc(t.firstClosed, "PV-receptie-calitativa.pdf", "Proces-verbal de recepție calitativă", [
    "Materialele livrate au fost verificate vizual și dimensional la descărcare; nu s-au constatat neconformități.",
  ]);
  orderDoc(
    t.warrantyOriginal,
    "PV-constatare-12-defecte-pavele.pdf",
    "Proces-verbal de constatare nr. 12",
    [
      "La punerea în operă s-au constatat fisuri la muchii pe 4 paleți de pavele din lotul livrat.",
      "Se solicită înlocuirea în garanție; paleții afectați se returnează furnizorului.",
    ],
    -1,
  );
  orderDoc(
    t.firstRental,
    "PV-predare-primire-echipamente.pdf",
    "Proces-verbal de predare-primire echipamente",
    ["S-au predat 60 de panouri de cofraj și 4 containere de 7 mc, în stare bună de funcționare."],
  );
  orderDoc(
    t.largestDelivery,
    "Aviz-insotire-semnat.pdf",
    "Aviz de însoțire a mărfii (exemplar semnat)",
    [
      "Aviz semnat de beneficiar la primire; cantitățile corespund comenzii și declarației e-Transport.",
    ],
  );

  return specs;
}

// -----------------------------------------------------------------------------

function sqlText(value: string | null): string {
  return value === null ? "null" : `$demo$${value}$demo$`;
}

async function main(): Promise<void> {
  // jiti compileaza JSX-ul in modul "classic" (`React.createElement`), inclusiv in
  // src/features/certificates/pdf.tsx - Next foloseste runtime-ul automat, deci acolo
  // nu exista `import React`.
  (globalThis as { React?: typeof React }).React = React;
  const [inputPath, outDir] = process.argv.slice(2);
  if (!inputPath || !outDir) {
    throw new Error("Utilizare: build-demo-artifacts.tsx <export.json> <out-dir>");
  }

  registerPdfFonts();
  const data = unwrapExport(JSON.parse(await readFile(inputPath, "utf8")));
  if (!data.organization) throw new Error("Organizația demo nu există în export.");
  const org = data.organization;

  const sql: string[] = ["-- Generat de scripts/demo/build-demo-artifacts.tsx", "begin;"];

  // Certificate, numerotate în ordinea închiderii comenzilor.
  let seq = Number(data.existingCertificates);
  for (const order of data.closedOrders) {
    seq += 1;
    const year = new Date(order.closedAt).getFullYear();
    const number = `CRT-${year}-${String(seq).padStart(4, "0")}`;
    const raw = rawDataForOrder(data, order.id);
    const { graph, materials } = buildTraceabilityGraph(raw);
    const snapshot: TraceabilitySnapshot = {
      version: TRACEABILITY_SNAPSHOT_VERSION,
      generatedAt: order.closedAt,
      order: {
        id: order.id,
        number: order.number,
        clientName: order.clientName,
        clientCui: order.clientCui,
      },
      deliveredItems: aggregateDeliveredItems(raw.delivered),
      graph,
      materials,
    };

    const element = createElement(CertificatePdfDocument, {
      snapshot,
      certificateNumber: number,
      orgName: org.name,
      brandColor: org.primary_color ?? undefined,
      accentColor: org.secondary_color ?? undefined,
    });
    const pdf = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
    const storagePath = `${org.id}/${order.id}/${number}.pdf`;
    const file = path.join(outDir, "storage", "certificates", storagePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, pdf);

    sql.push(
      `insert into public.certificates (organization_id, order_id, number, issued_at, traceability_snapshot, pdf_path, created_at, updated_at) values ('${org.id}', '${order.id}', '${number}', '${order.closedAt}', ${sqlText(JSON.stringify(snapshot))}::jsonb, '${storagePath}', '${order.closedAt}', '${order.closedAt}');`,
    );
    console.info(`certificat ${number} -> ${order.number} (${materials.length} materiale)`);
  }
  if (data.closedOrders.length > 0) {
    const year = new Date(data.closedOrders.at(-1)!.closedAt).getFullYear();
    sql.push(
      `insert into public.certificate_counters (organization_id, year, seq, updated_at) values ('${org.id}', ${year}, ${seq}, now()) on conflict (organization_id, year) do update set seq = greatest(public.certificate_counters.seq, excluded.seq), updated_at = now();`,
    );
  }

  // Documente (doar la prima rulare - evită duplicatele).
  if (Number(data.existingDocuments) === 0) {
    for (const spec of documentSpecs(data)) {
      const pdf = await renderToBuffer(
        createElement(DemoDocument, { spec, orgName: org.name }) as unknown as Parameters<
          typeof renderToBuffer
        >[0],
      );
      const storagePath = `${org.id}/${spec.ownerType}/${spec.ownerId}/${randomUUID()}-${sanitizeFileName(spec.fileName)}`;
      const file = path.join(outDir, "storage", "documents", storagePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, pdf);
      sql.push(
        `insert into public.documents (organization_id, owner_type, owner_id, file_path, file_name, mime_type, size_bytes, description, uploaded_by, created_at) values ('${org.id}', '${spec.ownerType}', '${spec.ownerId}', ${sqlText(storagePath)}, ${sqlText(spec.fileName)}, 'application/pdf', ${pdf.length}, ${sqlText(spec.description)}, '${data.adminUserId}', '${spec.createdAt}');`,
      );
      console.info(`document ${spec.fileName} -> ${spec.ownerType}`);
    }
  } else {
    console.info("documente: organizația are deja documente - sărit.");
  }

  sql.push("commit;");
  await writeFile(path.join(outDir, "artifacts.sql"), `${sql.join("\n")}\n`);
  console.info(`\nGata: ${path.join(outDir, "artifacts.sql")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
