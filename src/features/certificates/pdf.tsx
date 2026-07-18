import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { layoutSankey } from "@/features/production/sankey-data";
import type { TraceabilitySnapshot } from "./types";

/** Culori implicite (tema "forest" a mockup-ului) — suprascrise de brandingul organizatiei. */
const DEFAULT_BRAND_COLOR = "#2b3a2f";
const DEFAULT_ACCENT_COLOR = "#4d6b53";

/**
 * PDF-ul certificatului — Task G, decizie S3/PDF (vezi
 * docs/plans/task-g-certificate.md si comentariul din `service.ts#renderCertificatePdf`).
 * `@react-pdf/renderer` deseneaza pur JS (fara Chromium), potrivit pt. Vercel
 * serverless. Graful de trasabilitate se randeaza cu primitivele SVG proprii ale
 * libraeriei (<Svg>/<Rect>/<Path>), alimentate de ACEEASI functie de layout
 * (`layoutSankey`, din production/sankey-data.ts) folosita de componenta React
 * din browser (`SankeyDiagram`) — geometria (pozitii, curbe Bezier) se
 * calculeaza o singura data, in doua randari diferite.
 */

export interface CertificatePdfProps {
  snapshot: TraceabilitySnapshot;
  orgName: string;
  brandColor?: string;
  accentColor?: string;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

const styles = StyleSheet.create({
  page: { paddingBottom: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1c2b20" },
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
const GRAPH_HEIGHT = 190;

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

  const { positioned, ribbons, nodeWidth } = layoutSankey(snapshot.graph, {
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
    nodeWidth: 10,
  });

  // Aceeasi conventie ca `SankeyDiagram` (browser): nodul de proces foloseste
  // culoarea de brand, restul (sursa/lot/livrare) culoarea de accent.
  const maxColumn = Math.max(...positioned.map((n) => n.column));

  return (
    <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
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
      {positioned.map((node) => {
        const rightAligned = node.column >= maxColumn - 1;
        const textX = rightAligned ? node.x - 4 : node.x + nodeWidth + 4;
        return (
          <Text
            key={`${node.id}-label`}
            x={textX}
            y={node.y + node.h / 2 - (node.sublabel ? 3 : 0)}
            style={{ fontSize: 7.5, textAnchor: rightAligned ? "end" : "start" }}
          >
            {node.label}
          </Text>
        );
      })}
      {positioned
        .filter((node) => node.sublabel)
        .map((node) => {
          const rightAligned = node.column >= maxColumn - 1;
          const textX = rightAligned ? node.x - 4 : node.x + nodeWidth + 4;
          return (
            <Text
              key={`${node.id}-sub`}
              x={textX}
              y={node.y + node.h / 2 + 7}
              style={{ fontSize: 6.5, fill: "#6b7a70", textAnchor: rightAligned ? "end" : "start" }}
            >
              {node.sublabel}
            </Text>
          );
        })}
    </Svg>
  );
}

export function CertificatePdfDocument({
  snapshot,
  orgName,
  brandColor = DEFAULT_BRAND_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
}: CertificatePdfProps) {
  return (
    <Document title={`Certificat ${snapshot.order.number ?? snapshot.order.id}`}>
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
              <Text style={styles.certMeta}>Nr. {snapshot.order.number ?? "—"} · CRT</Text>
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
              <Text style={styles.infoValue}>{snapshot.order.number ?? "—"}</Text>
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
              <Text style={{ fontSize: 8, color: "#6b7a70" }}>
                Semnătură &amp; ștampilă electronică
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>{orgName} · trasabilitate emisă de Lateris Trace</Text>
          <Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
