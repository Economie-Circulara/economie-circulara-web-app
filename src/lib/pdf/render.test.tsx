// @vitest-environment node
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { CertificatePdfDocument } from "@/features/certificates/pdf";
import { AvizPdfDocument } from "@/features/deliveries/pdf";

/**
 * Randare REALA (fara mock pe `@react-pdf/renderer`) a documentelor PDF. Celelalte teste
 * mock-uiesc renderer-ul, deci nu prind erori de randare - ex. un `fontStyle` pentru care
 * familia inregistrata in `fonts.ts` nu are font, care facea generarea certificatului si
 * a avizului sa arunce in productie.
 */
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

describe("randare PDF (fara mock)", () => {
  it("certificatul de trasabilitate se randeaza", async () => {
    const buffer = await renderToBuffer(
      <CertificatePdfDocument
        certificateNumber="CRT-2026-0001"
        orgName="Organizație Test"
        snapshot={{
          version: 1,
          generatedAt: "2026-09-01T10:00:00.000Z",
          order: {
            id: "o1",
            number: "CMD-2026-0001",
            clientName: "Client Test SRL",
            clientCui: "RO1",
          },
          deliveredItems: [{ itemId: "i1", itemTitle: "Pavele eco", unit: "palet", quantity: 10 }],
          graph: { nodes: [], links: [] },
          materials: [
            {
              material: "Agregat reciclat 0-4 mm",
              origin: "Reciclare",
              source: "Concasare moloz",
              quantity: 4.5,
              unit: "tona",
              percentage: 100,
            },
          ],
        }}
      />,
    );
    expect(isPdf(buffer)).toBe(true);
  });

  it("avizul de însoțire se randează", async () => {
    const buffer = await renderToBuffer(
      <AvizPdfDocument
        orgName="Organizație Test"
        delivery={{
          id: "d1",
          organizationId: "org1",
          orderId: "o1",
          scheduledDate: "2026-09-02",
          carrierName: "Transportator Test SRL",
          vehiclePlate: "IF-01-TST",
          driverName: "Șofer Test",
          routeOrigin: "Depozit",
          routeDestination: "Șantier",
          uitCode: "MOCK-UIT-ABCDEF1234",
          declarationStatus: "declared",
          declarationError: null,
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-01T10:00:00.000Z",
          orderNumber: "CMD-2026-0001",
          clientName: "Client Test SRL",
          clientCui: "RO1",
          items: [{ itemId: "i1", itemTitle: "Pavele eco", unit: "palet", quantity: 10 }],
        }}
      />,
    );
    expect(isPdf(buffer)).toBe(true);
  });
});
