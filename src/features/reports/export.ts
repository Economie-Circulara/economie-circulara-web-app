import {
  formatDeliveriesReport,
  formatOrdersByStatusReport,
  formatPaasUsageReport,
  formatRecycledMaterialsReport,
  formatReturnsReport,
  formatSecondaryMaterialReport,
  type FormattedReport,
} from "./format";
import { REPORT_META, type ReportKey } from "./labels";
import type { DateRange } from "./period";
import {
  getDeliveriesReport,
  getOrdersByStatusReport,
  getPaasUsageReport,
  getRecycledMaterialsReport,
  getReturnsReport,
  getSecondaryMaterialReport,
} from "./queries";

/**
 * Dispatch pe cheia raportului (`ReportKey`) — un singur loc care leaga fetch + format,
 * folosit de ambele rute de export (`export/pdf`, `export/csv`) ca sa nu duplice
 * switch-ul intre cele doua formate.
 */
export async function loadFormattedReport(
  key: ReportKey,
  range: DateRange,
): Promise<FormattedReport & { title: string; description: string }> {
  const meta = REPORT_META[key];
  let formatted: FormattedReport;

  switch (key) {
    case "comenzi":
      formatted = formatOrdersByStatusReport(await getOrdersByStatusReport(range));
      break;
    case "livrari":
      formatted = formatDeliveriesReport(await getDeliveriesReport(range));
      break;
    case "retururi":
      formatted = formatReturnsReport(await getReturnsReport(range));
      break;
    case "materiale-reciclate":
      formatted = formatRecycledMaterialsReport(await getRecycledMaterialsReport(range));
      break;
    case "paas-utilizare":
      formatted = formatPaasUsageReport(await getPaasUsageReport(range));
      break;
    case "materii-secundare":
      formatted = formatSecondaryMaterialReport(await getSecondaryMaterialReport(range));
      break;
  }

  return { ...formatted, title: meta.title, description: meta.description };
}
