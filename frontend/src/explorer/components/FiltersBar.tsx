import React from "react";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

export type PageSizeJournal = 15 | 30 | 50;

type FiltersBarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  typeOptions: { value: string; label: string }[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  pageSize: PageSizeJournal;
  onPageSizeChange: (n: PageSizeJournal) => void;
  resultCount: number;
  className?: string;
};

/**
 * Поиск и фильтры по журналу (режим аудит / chain задаётся вкладками выше).
 */
export const FiltersBar: React.FC<FiltersBarProps> = ({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  typeOptions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  pageSize,
  onPageSizeChange,
  resultCount,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 lg:flex-row lg:flex-wrap lg:items-end",
      className
    )}
  >
    <div className="min-w-[200px] flex-1">
      <label className="mb-1 block text-xs font-medium text-slate-500">Поиск</label>
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="document_id, tx_hash, кошелёк, код события…"
        className="h-9"
        aria-label="Поиск по журналу"
      />
    </div>

    <div className="w-full min-w-[140px] sm:w-44">
      <label className="mb-1 block text-xs font-medium text-slate-500">Тип события</label>
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {typeOptions.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>

    <div className="flex flex-wrap gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Дата с</label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Дата по</label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
    </div>

    <div className="w-full min-w-[120px] sm:w-36">
      <label className="mb-1 block text-xs font-medium text-slate-500">Строк на странице</label>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSizeJournal)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value={15}>15</option>
        <option value={30}>30</option>
        <option value={50}>50</option>
      </select>
    </div>

    <div className="flex flex-1 items-center justify-end pb-1 lg:min-w-[120px]">
      <span className="text-xs text-slate-500">Всего по фильтру: {resultCount}</span>
    </div>
  </div>
);
