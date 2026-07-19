import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { getDeliveryDetail } from "@/features/deliveries/queries";
import { renderAvizPdfBuffer } from "@/features/deliveries/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Ruta de descarcare a avizului PDF (Task X5) — randat ON-DEMAND din datele
 * curente ale livrarii (nu stocat in Storage, vezi comentariul din
 * 0013_deliveries.sql), ca sa reflecte mereu UIT-ul/statusul cel mai recent,
 * inclusiv dupa o re-incercare de declarare. Doar staff (`requireRole` — un
 * `redirect()` in interiorul unui Route Handler produce un raspuns 307 catre
 * ruta de login/dashboard, comportament acceptabil pt. un link deschis direct).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const delivery = await getDeliveryDetail(id);
  if (!delivery) {
    return new NextResponse("Livrare inexistentă.", { status: 404 });
  }

  const org = await getCurrentOrg();
  const buffer = await renderAvizPdfBuffer(
    delivery,
    org?.name ?? "Lateris Trace",
    org?.primaryColor,
    org?.secondaryColor,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="aviz-${delivery.orderNumber ?? delivery.id}.pdf"`,
    },
  });
}
