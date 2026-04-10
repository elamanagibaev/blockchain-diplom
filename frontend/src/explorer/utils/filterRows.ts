import type { ExplorerRow } from "../types";

function rowMatchesSearch(row: ExplorerRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;

  const parts: string[] = [
    row.documentId ?? "",
    row.documentLabel ?? "",
    row.extra,
    row.initiator?.display ?? "",
  ];

  if (row.rowKind === "audit") {
    parts.push(row.action);
    if (row.metadata) {
      for (const v of Object.values(row.metadata)) {
        if (v !== null && v !== undefined) parts.push(typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
  } else {
    parts.push(row.txHash, row.actionType, row.fromWallet ?? "", row.toWallet ?? "");
  }

  return parts.some((p) => p.toLowerCase().includes(s));
}

function parseDayStart(isoDate: string): number | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function parseDayEnd(isoDate: string): number | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T23:59:59.999`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/** Фильтрация строк журнала по поиску, типу и диапазону дат (клиентская; заменить запросом к API). */
export function filterExplorerRows(
  rows: ExplorerRow[],
  options: {
    search: string;
    typeFilter: string;
    dateFrom: string;
    dateTo: string;
  }
): ExplorerRow[] {
  const { search, typeFilter, dateFrom, dateTo } = options;
  const fromMs = parseDayStart(dateFrom);
  const toMs = parseDayEnd(dateTo);

  return rows.filter((row) => {
    if (!rowMatchesSearch(row, search)) return false;

    if (typeFilter) {
      if (row.rowKind === "audit" && row.action !== typeFilter) return false;
      if (row.rowKind === "chain" && row.actionType !== typeFilter) return false;
    }

    const t = new Date(row.timestamp).getTime();
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;

    return true;
  });
}

/** Сортировка: новые сверху. */
export function sortRowsByTimeDesc(rows: ExplorerRow[]): ExplorerRow[] {
  return [...rows].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
