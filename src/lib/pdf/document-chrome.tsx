import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfHeaderVariant } from "@/features/branding/themes";

/**
 * Antetul si subsolul comune ale PDF-urilor (certificat, aviz, rapoarte). Stilul
 * antetului vine din tema organizatiei (`ThemeDefinition.pdfHeader`, plan
 * multi-domain-tenant-profiles T6), ca documentele a doua organizatii cu teme
 * diferite sa nu arate identic. Continutul (nume, titlu, randuri de meta) il da
 * fiecare document.
 */

const INK = "#1c2b20";
const MUTED = "#6b7a70";

const styles = StyleSheet.create({
  topBar: { height: 6 },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 16,
    marginBottom: 18,
  },
  band: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 24,
    paddingBottom: 20,
  },
  bandStripe: { height: 4, marginBottom: 20 },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: "#c9cdd3",
    paddingBottom: 14,
    marginBottom: 18,
  },
  ruleOrg: { borderLeftWidth: 5, paddingLeft: 10 },
  orgName: { fontSize: 16, fontWeight: 700 },
  orgLine: { fontSize: 9, marginTop: 2 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  ruleTitle: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meta: { fontSize: 9, textAlign: "right", marginTop: 3 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    fontSize: 8,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});

export interface PdfDocumentHeaderProps {
  variant: PdfHeaderVariant;
  brandColor: string;
  accentColor: string;
  /** Padding-ul orizontal al corpului documentului (antetul se aliniaza cu el). */
  paddingX: number;
  orgName: string;
  /** Randuri sub numele organizatiei (subtitlu, date fiscale). */
  orgLines: string[];
  title: string;
  meta: string[];
}

/**
 * Antetul documentului. Se randeaza INAINTEA corpului (nu in el): varianta `band`
 * ocupa toata latimea paginii, iar `bar` are o banda de accent repetata pe fiecare
 * pagina (`fixed`).
 */
export function PdfDocumentHeader({
  variant,
  brandColor,
  accentColor,
  paddingX,
  orgName,
  orgLines,
  title,
  meta,
}: PdfDocumentHeaderProps) {
  if (variant === "band") {
    return (
      <View>
        <View style={[styles.band, { backgroundColor: brandColor, paddingHorizontal: paddingX }]}>
          <View>
            <Text style={[styles.orgName, { color: "#ffffff" }]}>{orgName}</Text>
            {orgLines.map((line) => (
              <Text key={line} style={[styles.orgLine, { color: "#e8ece9" }]}>
                {line}
              </Text>
            ))}
          </View>
          <View>
            <Text style={[styles.title, { color: "#ffffff" }]}>{title}</Text>
            {meta.map((line) => (
              <Text key={line} style={[styles.meta, { color: "#e8ece9" }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
        <View style={[styles.bandStripe, { backgroundColor: accentColor }]} />
      </View>
    );
  }

  if (variant === "rule") {
    return (
      <View style={{ paddingHorizontal: paddingX, paddingTop: 28 }}>
        <View style={styles.ruleHeader}>
          <View style={[styles.ruleOrg, { borderLeftColor: accentColor }]}>
            <Text style={[styles.orgName, { color: brandColor }]}>{orgName}</Text>
            {orgLines.map((line) => (
              <Text key={line} style={[styles.orgLine, { color: MUTED }]}>
                {line}
              </Text>
            ))}
          </View>
          <View>
            <Text style={[styles.ruleTitle, { color: brandColor }]}>{title}</Text>
            {meta.map((line) => (
              <Text key={line} style={[styles.meta, { color: MUTED }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.topBar, { backgroundColor: accentColor }]} fixed />
      <View style={{ paddingHorizontal: paddingX, paddingTop: 28 }}>
        <View style={styles.barHeader}>
          <View>
            <Text style={[styles.orgName, { color: brandColor }]}>{orgName}</Text>
            {orgLines.map((line) => (
              <Text key={line} style={[styles.orgLine, { color: MUTED }]}>
                {line}
              </Text>
            ))}
          </View>
          <View>
            <Text style={[styles.title, { color: INK }]}>{title}</Text>
            {meta.map((line) => (
              <Text key={line} style={[styles.meta, { color: MUTED }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export interface PdfDocumentFooterProps {
  variant: PdfHeaderVariant;
  brandColor: string;
  paddingX: number;
  /** Textul din stanga (organizatie + credit). */
  label: string;
  /** Nota din profilul tenantului (ex. date de contact), la mijloc. */
  note?: string | null;
}

/** Subsolul repetat pe fiecare pagina, cu numarul paginii. */
export function PdfDocumentFooter({
  variant,
  brandColor,
  paddingX,
  label,
  note,
}: PdfDocumentFooterProps) {
  const background = variant === "band" ? brandColor : INK;
  return (
    <View
      style={[
        styles.footer,
        { backgroundColor: background, color: "#dfe4e0", paddingHorizontal: paddingX },
      ]}
      fixed
    >
      <Text>{label}</Text>
      {note ? <Text>{note}</Text> : null}
      <Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber}/${totalPages}`} />
    </View>
  );
}
