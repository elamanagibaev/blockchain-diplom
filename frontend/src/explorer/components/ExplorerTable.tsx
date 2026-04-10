import React from "react";
import type { ExplorerRow } from "../types";
import { EventRow } from "./EventRow";
import { cn } from "@/lib/utils";

type ExplorerTableProps = {
  rows: ExplorerRow[];
  onView: (row: ExplorerRow) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
};

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  rows,
  onView,
  loading = false,
  emptyMessage = "Записи не найдены",
  className,
}) => (
  <div className={cn("w-full overflow-x-auto", className)}>
    <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-white">
          <th className="w-11 px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Просмотр
          </th>
          <th className="w-[200px] px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Тип события
          </th>
          <th className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Документ
          </th>
          <th className="w-36 px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Время
          </th>
          <th className="w-[220px] px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Инициатор
          </th>
          <th className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Дополнительно
          </th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={6} className="py-14 text-center text-sm text-slate-500">
              Загрузка журнала…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-14 text-center text-sm text-slate-500">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => <EventRow key={row.id} row={row} onView={onView} />)
        )}
      </tbody>
    </table>
  </div>
);
