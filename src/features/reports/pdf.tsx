import { createElement } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatRangeLabel, type DateRange } from "./period";

/**
 * PDF generic de raport (Task X3) — acelasi motor ca certificatele
 * (`certificates/pdf.tsx`): `@react-pdf/renderer`, randare pur JS (fara Chromium,
 * potrivit pt. Vercel serverless). Un singur layout tabelar (antet white-label +
 * titlu + perioada + tabel + rand de total optional) reutilizat de toate cele 6
 * rapoarte — doar datele (coloane/randuri) difera per raport.
 */

const DEFAULT_BRAND_COLOR = "#2b3a2f";
const DEFAULT_ACCENT_COLOR = "#4d6b53";

export interface ReportPdfColumn {
  key: string;
  header: string;
  /** `"right"` pt. coloane numerice. Implicit `"left"`. */
  align?: "left" | "right";
  /** Ponderea relativa a coloanei (flex) — implicit 1. */
  flex?: number;
}

export interface ReportPdfDocumentProps {
  reportTitle: string;
  reportDescription?: string;
  range: DateRange;
  orgName: string;
  brandColor?: string | null;
  accentColor?: string | null;
  columns: ReportPdfColumn[];
  rows: Record<string, string>[];
  /** Randuri suplimentare de sumar, afisate sub tabel (ex. total, medie). */
  summary?: { label: string; value: string }[];
  emptyMessage?: string;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#1c2b20" },
  topBar: { height: 6, backgroundColor: "#4d6b53" },
  body: { paddingHorizontal: 36, paddingTop: 26 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1c2b20",
    paddingBottom: 14,
    marginBottom: 16,
  },
  orgName: { fontSize: 15, fontWeight: 700 },
  orgSub: { fontSize: 8.5, color: "#6b7a70", marginTop: 2 },
  reportTitle: { fontSize: 12.5, fontWeight: 700, textAlign: "right" },
  reportMeta: { fontSize: 8.5, color: "#6b7a70", textAlign: "right", marginTop: 3 },
  description: { fontSize: 9, color: "#5c6b60", marginBottom: 14 },
  table: { marginBottom: 16 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dde3de",
    paddingBottom: 5,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e7ebe8",
    paddingVertical: 4,
  },
  th: { fontSize: 7.5, color: "#8a978f", textTransform: "uppercase" },
  td: { fontSize: 9 },
  summaryBox: {
    backgroundColor: "#f4f6f4",
    borderWidth: 1,
    borderColor: "#dde3de",
    borderRadius: 6,
    padding: 10,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryLabel: { fontSize: 8.5, color: "#6b7a70" },
  summaryValue: { fontSize: 9.5, fontWeight: 700 },
  pageFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1c2b20",
    color: "#cdd6cf",
    fontSize: 8,
    paddingVertical: 7,
    paddingHorizontal: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

export function ReportPdfDocument({
  reportTitle,
  reportDescription,
  range,
  orgName,
  brandColor = DEFAULT_BRAND_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
  columns,
  rows,
  summary,
  emptyMessage = "Fără date în perioada selectată.",
}: ReportPdfDocumentProps) {
  return (
    <Document title={reportTitle}>
      <Page size="A4" style={styles.page}>
        <View
          style={[styles.topBar, { backgroundColor: accentColor ?? DEFAULT_ACCENT_COLOR }]}
          fixed
        />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.orgName, { color: brandColor ?? DEFAULT_BRAND_COLOR }]}>
                {orgName}
              </Text>
              <Text style={styles.orgSub}>Materiale de construcții circulare</Text>
            </View>
            <View>
              <Text style={styles.reportTitle}>{reportTitle}</Text>
              <Text style={styles.reportMeta}>Perioadă: {formatRangeLabel(range)}</Text>
              <Text style={styles.reportMeta}>Generat: {dateFormatter.format(new Date())}</Text>
            </View>
          </View>

          {reportDescription ? <Text style={styles.description}>{reportDescription}</Text> : null}

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={[styles.th, { flex: col.flex ?? 1, textAlign: col.align ?? "left" }]}
                >
                  {col.header}
                </Text>
              ))}
            </View>
            {rows.map((row, index) => (
              <View key={index} style={styles.tableRow}>
                {columns.map((col) => (
                  <Text
                    key={col.key}
                    style={[styles.td, { flex: col.flex ?? 1, textAlign: col.align ?? "left" }]}
                  >
                    {row[col.key] ?? "—"}
                  </Text>
                ))}
              </View>
            ))}
            {rows.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#8a978f", marginTop: 6 }}>{emptyMessage}</Text>
            ) : null}
          </View>

          {summary && summary.length > 0 ? (
            <View style={styles.summaryBox}>
              {summary.map((item) => (
                <View key={item.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>{orgName} · raport generat de Lateris Trace</Text>
          <Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Randeaza PDF-ul unui raport (buffer) — apelat din rutele de export. */
export async function renderReportPdf(props: ReportPdfDocumentProps): Promise<Buffer> {
  const element = createElement(ReportPdfDocument, props);
  // Vezi comentariul echivalent din `certificates/service.ts#renderCertificatePdf`:
  // `renderToBuffer` tipizeaza strict argumentul, dar accepta la runtime orice element
  // care randeaza in final un <Document>.
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}
