import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { layoutSankey } from "@/features/production/sankey-data";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf/fonts";
import type { TraceabilitySnapshot } from "./types";

/** Culori implicite (tema "forest" a mockup-ului) - suprascrise de brandingul organizatiei. */
const DEFAULT_BRAND_COLOR = "#2b3a2f";
const DEFAULT_ACCENT_COLOR = "#4d6b53";

/**
 * PDF-ul certificatului - Task G, decizie S3/PDF (vezi
 * docs/plans/task-g-certificate.md si comentariul din `service.ts#renderCertificatePdf`).
 * `@react-pdf/renderer` deseneaza pur JS (fara Chromium), potrivit pt. Vercel
 * serverless. Graful de trasabilitate se randeaza cu primitivele SVG proprii ale
 * libraeriei (<Svg>/<Rect>/<Path>), alimentate de ACEEASI functie de layout
 * (`layoutSankey`, din production/sankey-data.ts) folosita de componenta React
 * din browser (`SankeyDiagram`) - geometria (pozitii, curbe Bezier) se
 * calculeaza o singura data, in doua randari diferite.
 */

export interface CertificatePdfProps {
  snapshot: TraceabilitySnapshot;
  /**
   * Numarul CERTIFICATULUI (`certificates.number`, format `CRT-<an>-<seq>`), nu al
   * comenzii. Obligatoriu: inainte exista doar `snapshot.order.number`, iar PDF-ul
   * afisa numarul comenzii etichetat drept numar de certificat - incoerent cu
   * ecranul (`certificate-view.tsx`, care folosea numarul corect) si cu randul din
   * `certificates`. Tip non-optional ca omisiunea sa cada la `typecheck`.
   */
  certificateNumber: string;
  orgName: string;
  brandColor?: string;
  accentColor?: string;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

registerPdfFonts();

const styles = StyleSheet.create({
  page: { paddingBottom: 48, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1c2b20" },
  topBar: { height: 6, backgroundColor: "#4d6b53" },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1c2b20",
    paddingBottom: 16,
    marginBottom: 18,
  },
  orgName: { fontSize: 16, fontWeight: 700 },
  orgSub: { fontSize: 9, color: "#6b7a70", marginTop: 2 },
  certTitle: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  certMeta: { fontSize: 9, color: "#6b7a70", textAlign: "right", marginTop: 3 },
  infoRow: { flexDirection: "row", marginBottom: 20, gap: 16 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 8, color: "#8a978f", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  infoSub: { fontSize: 9, color: "#6b7a70", marginTop: 1 },
  sectionBox: {
    backgroundColor: "#f4f6f4",
    borderWidth: 1,
    borderColor: "#dde3de",
    borderRadius: 6,
    padding: 14,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
  table: { marginBottom: 20 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dde3de",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e7ebe8",
    paddingVertical: 5,
  },
  th: { fontSize: 8, color: "#8a978f", textTransform: "uppercase" },
  td: { fontSize: 9.5 },
  colMaterial: { flex: 2 },
  colOrigin: { flex: 2 },
  colSource: { flex: 2 },
  colPct: { flex: 1, textAlign: "right" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  signatureBox: { width: 170, textAlign: "center" },
  signatureLine: {
    fontSize: 12,
    fontStyle: "italic",
    borderBottomWidth: 1,
    borderBottomColor: "#1c2b20",
    paddingBottom: 6,
    marginBottom: 6,
  },
  pageFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1c2b20",
    color: "#cdd6cf",
    fontSize: 8,
    paddingVertical: 8,
    paddingHorizontal: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const GRAPH_WIDTH = 520;
const GRAPH_MIN_HEIGHT = 190;
/** Cat incape pe prima pagina sub antet - peste, caseta grafului sare pe pagina 2 si lasa pagina 1 goala. */
const GRAPH_MAX_HEIGHT = 430;
/** Spatiu vertical minim per nod - incape eticheta (7,5pt) + subeticheta (6,5pt). */
const GRAPH_ROW_HEIGHT = 26;
const GRAPH_NODE_GAP = 12;
const GRAPH_NODE_WIDTH = 10;
const GRAPH_PAD = 6;
const LABEL_FONT_SIZE = 7.5;
const SUBLABEL_FONT_SIZE = 6.5;

/**
 * Taie textul ca sa incapa in latimea unei coloane a grafului. Lanturile reale (FIFO pe
 * multe loturi, mai multe procese) produc zeci de noduri cu etichete lungi (ex. sursa
 * "Aviz DR-1143 - Demolări Rapid SRL (...)") care altfel se suprapun peste coloana vecina.
 * Latimea unui caracter e aproximata la ~0,5 × marimea fontului (Noto Sans).
 */
function fitLabel(text: string, maxWidth: number, fontSize: number): string {
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * 0.5)));
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function TraceabilityGraphSvg({
  snapshot,
  brandColor,
  accentColor,
}: {
  snapshot: TraceabilitySnapshot;
  brandColor: string;
  accentColor: string;
}) {
  if (snapshot.graph.nodes.length === 0) {
    return <Text style={{ fontSize: 9, color: "#8a978f" }}>Fără date de trasabilitate.</Text>;
  }

  // Inaltimea creste cu numarul maxim de noduri dintr-o coloana, ca nodurile mici sa nu
  // se stranga unele peste altele (cu etichetele lor).
  const nodesPerColumn = new Map<number, number>();
  snapshot.graph.nodes.forEach((node) =>
    nodesPerColumn.set(node.column, (nodesPerColumn.get(node.column) ?? 0) + 1),
  );
  const maxNodesInColumn = Math.max(1, ...nodesPerColumn.values());
  const graphHeight = Math.min(
    GRAPH_MAX_HEIGHT,
    Math.max(GRAPH_MIN_HEIGHT, maxNodesInColumn * GRAPH_ROW_HEIGHT),
  );
  // Toate etichetele stau la DREAPTA nodului (in spatiul pana la coloana urmatoare), deci
  // layout-ul lasa o coloana de etichete libera dupa ultima coloana de noduri - altfel
  // etichetele aliniate la stanga ale ultimelor coloane se suprapun cu cele vecine.
  const columnGaps = Math.max(1, nodesPerColumn.size - 1);
  const columnWidth = (GRAPH_WIDTH - 2 * GRAPH_PAD - GRAPH_NODE_WIDTH) / (columnGaps + 1);
  const labelWidth = columnWidth - GRAPH_NODE_WIDTH - 6;

  const { positioned, ribbons, nodeWidth } = layoutSankey(snapshot.graph, {
    width: GRAPH_WIDTH - columnWidth,
    height: graphHeight,
    nodeWidth: GRAPH_NODE_WIDTH,
    pad: GRAPH_PAD,
    gap: GRAPH_NODE_GAP,
  });

  // Aceeasi conventie ca `SankeyDiagram` (browser): nodul de proces foloseste
  // culoarea de brand, restul (sursa/lot/livrare) culoarea de accent.

  return (
    <Svg width={GRAPH_WIDTH} height={graphHeight} viewBox={`0 0 ${GRAPH_WIDTH} ${graphHeight}`}>
      {ribbons.map((ribbon) => (
        <Path key={ribbon.id} d={ribbon.d} fill={accentColor} fillOpacity={0.28} />
      ))}
      {positioned.map((node) => (
        <Rect
          key={node.id}
          x={node.x}
          y={node.y}
          width={nodeWidth}
          height={node.h}
          rx={2}
          fill={node.kind === "process" ? brandColor : accentColor}
        />
      ))}
      {positioned.map((node) => (
        <Text
          key={`${node.id}-label`}
          x={node.x + nodeWidth + 4}
          y={node.y + node.h / 2 - (node.sublabel ? 3 : 0)}
          style={{ fontFamily: PDF_FONT_FAMILY, fontSize: LABEL_FONT_SIZE }}
        >
          {fitLabel(node.label, labelWidth, LABEL_FONT_SIZE)}
        </Text>
      ))}
      {positioned
        .filter((node) => node.sublabel)
        .map((node) => (
          <Text
            key={`${node.id}-sub`}
            x={node.x + nodeWidth + 4}
            y={node.y + node.h / 2 + 7}
            style={{ fontFamily: PDF_FONT_FAMILY, fontSize: SUBLABEL_FONT_SIZE, fill: "#6b7a70" }}
          >
            {fitLabel(node.sublabel ?? "", labelWidth, SUBLABEL_FONT_SIZE)}
          </Text>
        ))}
    </Svg>
  );
}

export function CertificatePdfDocument({
  snapshot,
  certificateNumber,
  orgName,
  brandColor = DEFAULT_BRAND_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
}: CertificatePdfProps) {
  return (
    <Document title={`Certificat ${certificateNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.topBar, { backgroundColor: accentColor }]} fixed />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.orgName}>{orgName}</Text>
              <Text style={styles.orgSub}>Materiale de construcții circulare</Text>
            </View>
            <View>
              <Text style={styles.certTitle}>Certificat de trasabilitate</Text>
              <Text style={styles.certMeta}>Nr. {certificateNumber}</Text>
              <Text style={styles.certMeta}>
                Emis: {dateFormatter.format(new Date(snapshot.generatedAt))}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Client</Text>
              <Text style={styles.infoValue}>{snapshot.order.clientName}</Text>
              <Text style={styles.infoSub}>{snapshot.order.clientCui}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Comandă</Text>
              <Text style={styles.infoValue}>{snapshot.order.number ?? "-"}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Produs(e) livrat(e)</Text>
              {snapshot.deliveredItems.map((item) => (
                <Text key={item.itemId} style={styles.infoSub}>
                  {item.itemTitle} · {item.quantity.toLocaleString("ro-RO")} {item.unit}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Lanț de trasabilitate</Text>
            <TraceabilityGraphSvg
              snapshot={snapshot}
              brandColor={brandColor}
              accentColor={accentColor}
            />
          </View>

          <View style={styles.table}>
            <Text style={styles.sectionTitle}>Materiale și origine</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colMaterial]}>Material</Text>
              <Text style={[styles.th, styles.colOrigin]}>Origine</Text>
              <Text style={[styles.th, styles.colSource]}>Sursă</Text>
              <Text style={[styles.th, styles.colPct]}>Pondere</Text>
            </View>
            {snapshot.materials.map((row, index) => (
              <View key={`${row.material}-${index}`} style={styles.tableRow}>
                <Text style={[styles.td, styles.colMaterial]}>{row.material}</Text>
                <Text style={[styles.td, styles.colOrigin]}>{row.origin}</Text>
                <Text style={[styles.td, styles.colSource]}>{row.source}</Text>
                <Text style={[styles.td, styles.colPct]}>
                  {row.percentage.toLocaleString("ro-RO", { minimumFractionDigits: 1 })}%
                </Text>
              </View>
            ))}
            {snapshot.materials.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#8a978f" }}>Fără materiale identificate.</Text>
            ) : null}
          </View>

          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                Certificat generat automat
              </Text>
              <Text style={{ fontSize: 8.5, color: "#6b7a70" }}>
                Graful reflectă trasabilitatea inregistrată în platformă la data emiterii.
              </Text>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLine}>{orgName}</Text>
              {/*
                NU "semnătură electronică": PDF-ul nu e semnat eIDAS (nici avansat,
                nici calificat) - vezi docs/analiza-standarde-certificat.md. Formularea
                descrie exact ce este documentul.
              */}
              <Text style={{ fontSize: 8, color: "#6b7a70" }}>
                Emis electronic, fără semnătură olografă
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>{orgName} · trasabilitate emisă de Lot cu Lot</Text>
          <Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
