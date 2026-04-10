import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { ExplorerTabs } from "./components/ExplorerTabs";
import { FiltersBar, type PageSizeJournal } from "./components/FiltersBar";
import { ExplorerTable } from "./components/ExplorerTable";
import { EventDetailsModal } from "./components/EventDetailsModal";
import { MOCK_AUDIT_ROWS, MOCK_CHAIN_ROWS } from "./mockData";
import type { AuditExplorerRow, ChainExplorerRow, ExplorerMode, ExplorerRow } from "./types";
import { getAuditEventLabel, getChainEventLabel } from "./eventLabels";
import { filterExplorerRows, sortRowsByTimeDesc } from "./utils/filterRows";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { mapBlockchainEventToExplorerRow, mapDocumentEventToExplorerRow } from "./adapters";
import type { BlockchainEventApi, DocumentEventJournalApi } from "./api/types";

const USE_EXPLORER_MOCK = import.meta.env.VITE_EXPLORER_USE_MOCK === "true";

function formatReqError(e: unknown): string {
  if (typeof e === "object" && e !== null && "response" in e) {
    const data = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return JSON.stringify(data);
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export type ExplorerPageProps = {
  /** Подмена без запросов (юнит-тесты / сторибук). */
  auditRowsOverride?: AuditExplorerRow[];
  chainRowsOverride?: ChainExplorerRow[];
};

/**
 * Журнал событий: данные с GET /admin/journal/document-events и GET /blockchain/events.
 * Моки — только при VITE_EXPLORER_USE_MOCK=true.
 */
export const ExplorerPage: React.FC<ExplorerPageProps> = ({
  auditRowsOverride,
  chainRowsOverride,
}) => {
  const [auditSource, setAuditSource] = useState<AuditExplorerRow[]>([]);
  const [chainSource, setChainSource] = useState<ChainExplorerRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<ExplorerMode>("audit");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<PageSizeJournal>(15);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<ExplorerRow | null>(null);

  const fetchJournal = useCallback(async () => {
    if (auditRowsOverride != null && chainRowsOverride != null) {
      setAuditSource(auditRowsOverride);
      setChainSource(chainRowsOverride);
      setLoadState("done");
      setLoadError(null);
      return;
    }

    if (USE_EXPLORER_MOCK) {
      setAuditSource(MOCK_AUDIT_ROWS);
      setChainSource(MOCK_CHAIN_ROWS);
      setLoadState("done");
      setLoadError(null);
      return;
    }

    setLoadState("loading");
    setLoadError(null);

    const auditReq = api.get<DocumentEventJournalApi[]>("/admin/journal/document-events");
    const chainReq = api.get<BlockchainEventApi[]>("/blockchain/events");

    const [auditRes, chainRes] = await Promise.allSettled([auditReq, chainReq]);

    const errs: string[] = [];
    let auditRows: AuditExplorerRow[] = [];
    let chainRows: ChainExplorerRow[] = [];

    if (auditRes.status === "fulfilled") {
      auditRows = auditRes.value.data.map(mapDocumentEventToExplorerRow);
    } else {
      errs.push(`Журнал документов: ${formatReqError(auditRes.reason)}`);
    }

    if (chainRes.status === "fulfilled") {
      chainRows = chainRes.value.data.map(mapBlockchainEventToExplorerRow);
    } else {
      errs.push(`On-chain: ${formatReqError(chainRes.reason)}`);
    }

    setAuditSource(auditRows);
    setChainSource(chainRows);

    if (errs.length === 2) {
      setLoadState("error");
      setLoadError(errs.join("\n"));
    } else {
      setLoadState("done");
      if (errs.length === 1) setLoadError(errs[0]);
    }
  }, [auditRowsOverride, chainRowsOverride]);

  useEffect(() => {
    void fetchJournal();
  }, [fetchJournal]);

  const baseRows = mode === "audit" ? auditSource : chainSource;

  const typeOptions = useMemo(() => {
    if (mode === "audit") {
      const codes = [...new Set(auditSource.map((r) => r.action))].sort();
      return [
        { value: "", label: "Все типы" },
        ...codes.map((c) => ({ value: c, label: getAuditEventLabel(c, null) })),
      ];
    }
    const codes = [...new Set(chainSource.map((r) => r.actionType))].sort();
    return [
      { value: "", label: "Все типы" },
      ...codes.map((c) => ({ value: c, label: getChainEventLabel(c) })),
    ];
  }, [mode, auditSource, chainSource]);

  const filtered = useMemo(
    () => sortRowsByTimeDesc(filterExplorerRows(baseRows, { search, typeFilter, dateFrom, dateTo })),
    [baseRows, search, typeFilter, dateFrom, dateTo]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [mode, search, typeFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const tableLoading = loadState === "loading" || loadState === "idle";
  const rawEmpty =
    mode === "audit" ? auditSource.length === 0 && loadState === "done" : chainSource.length === 0 && loadState === "done";

  const emptyMessage =
    loadState === "error"
      ? "Не удалось загрузить данные"
      : rawEmpty
        ? mode === "audit"
          ? "Нет событий в журнале документов"
          : "Нет on-chain событий"
        : "Нет записей по текущим фильтрам";

  return (
    <div className="w-full max-w-none bg-slate-50 px-3 py-6 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Журнал событий</h1>
            <p className="text-sm text-slate-500">
              Источники:{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">GET /admin/journal/document-events</code>,{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">GET /blockchain/events</code>
              {USE_EXPLORER_MOCK ? " (режим моков)" : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchJournal()} disabled={tableLoading}>
            Обновить
          </Button>
        </div>

        {loadError && (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            <span className="font-medium">Частичная или полная ошибка загрузки. </span>
            <span className="whitespace-pre-wrap">{loadError}</span>
          </div>
        )}

        <ExplorerTabs mode={mode} onModeChange={setMode} />

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <FiltersBar
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            typeOptions={typeOptions}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            resultCount={tableLoading ? 0 : filtered.length}
          />
          <ExplorerTable
            rows={pageRows}
            onView={setDetail}
            loading={tableLoading}
            emptyMessage={emptyMessage}
          />
          {!tableLoading && filtered.length > 0 && (
            <div
              className={cn(
                "flex flex-col gap-2 border-t border-slate-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              )}
            >
              <span className="text-xs text-slate-500">
                Страница {page} из {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EventDetailsModal row={detail} open={detail !== null} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
};
