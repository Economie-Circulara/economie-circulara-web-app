import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/features/auth/session";
import { buildReportCsv } from "@/features/reports/csv";
import { loadFormattedReport } from "@/features/reports/export";
import { isReportKey } from "@/features/reports/labels";
import { parseDateRange } from "@/features/reports/period";

/**
 * Export CSV al unui raport din /rapoarte — acelasi format ca `/stoc/audit/export`
 * (`buildReportCsv`, BOM UTF-8 + CRLF). `?report=<cheie>&from=&to=`.
 */
export async function GET(request: NextRequest) {
  await requireRole(["admin", "operator"]);

  const { searchParams } = new URL(request.url);
  const reportParam = searchParams.get("report");
  if (!isReportKey(reportParam)) {
    return NextResponse.json({ error: "Raport necunoscut." }, { status: 400 });
  }

  const range = parseDateRange({ from: searchParams.get("from"), to: searchParams.get("to") });
  const report = await loadFormattedReport(reportParam, range);

  const headers = report.columns.map((col) => col.header);
  const rows = report.rows.map((row) => report.columns.map((col) => row[col.key] ?? "—"));
  const csv = buildReportCsv(headers, rows);

  const fileName = `${reportParam}-${range.from}_${range.to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
