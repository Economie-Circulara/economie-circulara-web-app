import { PLATFORM_NAME } from "@/lib/brand";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf/fonts";
import type { DeliveryDetail } from "./types";
import type { PdfHeaderVariant } from "@/features/branding/themes";
import { DEFAULT_DOCUMENT_TAGLINE } from "@/features/branding/tenant-profiles";
import { PdfDocumentFooter, PdfDocumentHeader } from "@/lib/pdf/document-chrome";

/** Culori implicite (tema "forest" a mockup-ului), suprascrise de brandingul organizatiei - ca la certificat. */
const DEFAULT_BRAND_COLOR = "#2b3a2f";
const DEFAULT_ACCENT_COLOR = "#4d6b53";

export interface AvizPdfProps {
  delivery: DeliveryDetail;
  orgName: string;
  brandColor?: string;
  accentColor?: string;
  /**
   * Creditul din subsol („emis de <X>”), din `issuerCreditFor` (features/branding).
   * `null` = fara credit (produsul poarta chiar numele organizatiei); lipsa = platforma.
   */
  issuerCredit?: string | null;
  /** Stilul antetului, din tema organizatiei (`pdfBrandFor`). */
  headerVariant?: PdfHeaderVariant;
  /** Subtitlul de sub numele organizatiei, din profilul tenantului. */
  tagline?: string;
  /** Nota din subsol, din profilul tenantului. */
  footerNote?: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const qtyFormatter = new Intl.NumberFormat("ro-RO");

registerPdfFonts();

/**
 * Textul afisat pt. codul UIT (RO e-Transport) pe aviz - functie PURA, separata de
 * randare ca sa fie testabila fara `@react-pdf/renderer` (vezi pdf.test.ts).
 * Trei cazuri: declarat (cod UIT), esuat (mesajul erorii - vizibil pe aviz, nu doar
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

/** Data livrarii, cu ora daca exista (0056) - pura, testata in pdf.test.ts. */
export function avizScheduleText(
  delivery: Pick<DeliveryDetail, "scheduledDate" | "scheduledTime">,
): string {
  const date = dateFormatter.format(new Date(delivery.scheduledDate));
  return delivery.scheduledTime ? `${date}, ora ${delivery.scheduledTime}` : date;
}

/**
 * Randurile sectiunii „Observații” de pe aviz - avizul tine loc de nota de comanda
 * (decizie 2026-10-08): observatiile comenzii, pomparea si observatiile livrarii,
 * DOAR cele completate. Lista goala = sectiunea nu se afiseaza.
 */
export function avizObservationLines(
  delivery: Pick<DeliveryDetail, "orderNotes" | "pumping" | "notes">,
): { label: string; text: string }[] {
  const lines: { label: string; text: string }[] = [];
  const add = (label: string, value: string | null) => {
    const text = value?.trim();
    if (text) lines.push({ label, text });
  };
  add("Comandă", delivery.orderNotes);
  add("Pompare", delivery.pumping);
  add("Livrare", delivery.notes);
  return lines;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 48, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1c2b20" },
  body: { paddingHorizontal: 40 },
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
  uitValue: { fontSize: 12, fontWeight: 700, fontFamily: PDF_FONT_FAMILY },
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
  observationRow: { flexDirection: "row", marginBottom: 4 },
  observationLabel: { width: 70, fontSize: 9, color: "#6b7a70" },
  observationText: { flex: 1, fontSize: 9.5 },
  signatureRow: { flexDirection: "row", gap: 16, marginTop: 28 },
  signatureBox: { flex: 1 },
  signatureTitle: { fontSize: 8, color: "#8a978f", textTransform: "uppercase", letterSpacing: 0.5 },
  signatureName: { fontSize: 9.5, marginTop: 3, minHeight: 12 },
  signatureSpace: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#1c2b20",
    marginBottom: 4,
  },
  signatureHint: { fontSize: 7.5, color: "#6b7a70" },
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
 * Avizul de insotire a marfii (Task X5) - PDF printabil, antet white-label, randat
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
  issuerCredit = PLATFORM_NAME,
  headerVariant = "bar",
  tagline = DEFAULT_DOCUMENT_TAGLINE,
  footerNote = null,
}: AvizPdfProps) {
  const observations = avizObservationLines(delivery);
  return (
    <Document title={`Aviz ${delivery.orderNumber ?? delivery.id}`}>
      <Page size="A4" style={styles.page}>
        <PdfDocumentHeader
          variant={headerVariant}
          brandColor={brandColor}
          accentColor={accentColor}
          paddingX={40}
          orgName={orgName}
          orgLines={[tagline]}
          title="Aviz de însoțire a mărfii"
          meta={[
            `Comandă ${delivery.orderNumber ?? "-"}`,
            `Data livrare: ${avizScheduleText(delivery)}`,
          ]}
        />
        <View style={styles.body}>
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
              <Text style={styles.infoSub}>
                {"-> "}
                {delivery.routeDestination}
              </Text>
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

          {observations.length > 0 ? (
            <View style={styles.table}>
              <Text style={styles.sectionTitle}>Observații</Text>
              {observations.map((line) => (
                <View key={line.label} style={styles.observationRow}>
                  <Text style={styles.observationLabel}>{line.label}</Text>
                  <Text style={styles.observationText}>{line.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                Aviz generat automat
              </Text>
              <Text style={{ fontSize: 8.5, color: "#6b7a70" }}>
                Emis: {dateFormatter.format(new Date())}
              </Text>
            </View>
          </View>

          {/*
            Stampila si semnatura se pun MANUAL, pe avizul tiparit (decizie 2026-10-08):
            PDF-ul nu e semnat electronic, deci nu pretinde asta.
          */}
          <View style={styles.signatureRow} wrap={false}>
            {[
              { title: "Furnizor", name: orgName },
              { title: "Delegat / Șofer", name: delivery.driverName },
              { title: "Beneficiar", name: delivery.receipt.receivedByName ?? "" },
            ].map((box) => (
              <View key={box.title} style={styles.signatureBox}>
                <Text style={styles.signatureTitle}>{box.title}</Text>
                <Text style={styles.signatureName}>{box.name}</Text>
                <View style={styles.signatureSpace} />
                <Text style={styles.signatureHint}>Semnătură și ștampilă</Text>
              </View>
            ))}
          </View>
        </View>

        <PdfDocumentFooter
          variant={headerVariant}
          brandColor={brandColor}
          paddingX={40}
          label={issuerCredit ? `${orgName} · aviz emis de ${issuerCredit}` : `${orgName} · aviz`}
          note={footerNote}
        />
      </Page>
    </Document>
  );
}
