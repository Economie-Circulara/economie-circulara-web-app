import { NextResponse } from "next/server";
import { requireRole } from "@/features/auth/session";
import { getFuelEntry } from "@/features/fleet/queries";
import { fuelReceiptSignedUrl } from "@/features/fleet/receipt-storage";
import { requireModule } from "@/features/modules/guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Deschide bonul unei alimentari: randul se citeste prin RLS (staff + modul), apoi
 * redirect catre un URL semnat de 60s (bucketul e privat, fara politici).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const { id } = await params;
  const entry = await getFuelEntry(id);
  if (!entry?.receipt) return new NextResponse("Bon inexistent.", { status: 404 });

  const url = await fuelReceiptSignedUrl(entry.receipt.path);
  if (!url) return new NextResponse("Bonul nu a putut fi deschis.", { status: 502 });
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
