import { NextResponse, type NextRequest } from "next/server";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { loadFormattedReport } from "@/features/reports/export";
import { isReportKey } from "@/features/reports/labels";
import { parseDateRange } from "@/features/reports/period";
import { renderReportPdf } from "@/features/reports/pdf";

/**
 * Export PDF al unui raport din /rapoarte (antet white-label per organizatie, ca la
 * certificate — vezi `certificates/pdf.tsx`). `?report=<cheie>&from=&to=`, aceleasi
 * filtre ca ecranul curent (vezi `rapoarte/page.tsx`).
 */
export async function GET(request: NextRequest) {
  await requireRole(["admin", "operator"]);

  const { searchParams } = new URL(request.url);
  const reportParam = searchParams.get("report");
  if (!isReportKey(reportParam)) {
    return NextResponse.json({ error: "Raport necunoscut." }, { status: 400 });
  }

  const range = parseDateRange({ from: searchParams.get("from"), to: searchParams.get("to") });
  const [report, org] = await Promise.all([
    loadFormattedReport(reportParam, range),
    getCurrentOrg(),
  ]);

  const pdfBuffer = await renderReportPdf({
    reportTitle: report.title,
    reportDescription: report.description,
    range,
    orgName: org?.name ?? "Lateris Trace",
    brandColor: org?.primaryColor,
    accentColor: org?.secondaryColor,
    columns: report.columns,
    rows: report.rows,
  });

  const fileName = `${reportParam}-${range.from}_${range.to}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
