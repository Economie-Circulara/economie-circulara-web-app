import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DeliveryDetail } from "./types";

/** Culori implicite (tema "forest" a mockup-ului), suprascrise de brandingul organizatiei — ca la certificat. */
const DEFAULT_BRAND_COLOR = "#2b3a2f";
const DEFAULT_ACCENT_COLOR = "#4d6b53";

export interface AvizPdfProps {
  delivery: DeliveryDetail;
  orgName: string;
  brandColor?: string;
  accentColor?: string;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const qtyFormatter = new Intl.NumberFormat("ro-RO");

/**
 * Textul afisat pt. codul UIT (RO e-Transport) pe aviz — functie PURA, separata de
 * randare ca sa fie testabila fara `@react-pdf/renderer` (vezi pdf.test.ts).
 * Trei cazuri: declarat (cod UIT), esuat (mesajul erorii — vizibil pe aviz, nu doar
 * in UI, util cand avizul e printat inainte de re-incercare), nedeclarat inca.
 */
export function avizUitStatusText(
  delivery: Pick<DeliveryDetail, "uitCode" | "declarationStatus" | "declarationError">,
): string {
  if (delivery.declarationStatus === "declared" && delivery.uitCode) {
    return delivery.uitCode;
  }
  if (delivery.declarationStatus === "failed") {
    return `Eroare declarare: ${delivery.declarationError ?? "motiv necunoscut"}`;
  }
  return "Nedeclarat încă";
}

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
  docTitle: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  docMeta: { fontSize: 9, color: "#6b7a70", textAlign: "right", marginTop: 3 },
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
  uitValue: { fontSize: 12, fontWeight: 700, fontFamily: "Courier" },
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
  colMaterial: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
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

/**
 * Avizul de insotire a marfii (Task X5) — PDF printabil, antet white-label, randat
 * ON-DEMAND (nu stocat, vezi comentariul din 0013_deliveries.sql) direct din datele
 * curente ale livrarii, deci reflecta mereu statusul/UIT-ul cel mai recent, chiar
 * dupa o re-incercare de declarare e-Transport. Stil vizual identic cu certificatul
 * de trasabilitate (`certificates/pdf.tsx`) pt. consistenta brand.
 */
export function AvizPdfDocument({
  delivery,
  orgName,
  brandColor = DEFAULT_BRAND_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
}: AvizPdfProps) {
  return (
    <Document title={`Aviz ${delivery.orderNumber ?? delivery.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.topBar, { backgroundColor: accentColor }]} fixed />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.orgName}>{orgName}</Text>
              <Text style={styles.orgSub}>Materiale de construcții circulare</Text>
            </View>
            <View>
              <Text style={styles.docTitle}>Aviz de însoțire a mărfii</Text>
              <Text style={styles.docMeta}>Comandă {delivery.orderNumber ?? "—"}</Text>
              <Text style={styles.docMeta}>
                Data livrare: {dateFormatter.format(new Date(delivery.scheduledDate))}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Client</Text>
              <Text style={styles.infoValue}>{delivery.clientName}</Text>
              <Text style={styles.infoSub}>{delivery.clientCui}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Transportator</Text>
              <Text style={styles.infoValue}>{delivery.carrierName}</Text>
              <Text style={styles.infoSub}>Vehicul: {delivery.vehiclePlate}</Text>
              <Text style={styles.infoSub}>Șofer: {delivery.driverName}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Rută</Text>
              <Text style={styles.infoValue}>{delivery.routeOrigin}</Text>
              <Text style={styles.infoSub}>→ {delivery.routeDestination}</Text>
            </View>
          </View>

          <View style={[styles.sectionBox, { borderColor: brandColor }]}>
            <Text style={styles.sectionTitle}>Declarație RO e-Transport</Text>
            <Text style={styles.uitValue}>{avizUitStatusText(delivery)}</Text>
          </View>

          <View style={styles.table}>
            <Text style={styles.sectionTitle}>Materiale transportate</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colMaterial]}>Material</Text>
              <Text style={[styles.th, styles.colQty]}>Cantitate</Text>
            </View>
            {delivery.items.map((item, index) => (
              <View key={`${item.itemId}-${index}`} style={styles.tableRow}>
                <Text style={[styles.td, styles.colMaterial]}>{item.itemTitle}</Text>
                <Text style={[styles.td, styles.colQty]}>
                  {qtyFormatter.format(item.quantity)} {item.unit}
                </Text>
              </View>
            ))}
            {delivery.items.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#8a978f" }}>Fără linii identificate.</Text>
            ) : null}
          </View>

          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                Aviz generat automat
              </Text>
              <Text style={{ fontSize: 8.5, color: "#6b7a70" }}>
                Emis: {dateFormatter.format(new Date())}
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
          <Text>{orgName} · aviz emis de Lateris Trace</Text>
          <Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
