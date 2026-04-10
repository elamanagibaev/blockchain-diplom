import React from "react";
import type { ExplorerMode } from "../types";
import { cn } from "@/lib/utils";

type ExplorerTabsProps = {
  mode: ExplorerMode;
  onModeChange: (m: ExplorerMode) => void;
  className?: string;
};

/**
 * Переключение журнала приложения и on-chain событий (разные источники данных).
 */
export const ExplorerTabs: React.FC<ExplorerTabsProps> = ({ mode, onModeChange, className }) => (
  <div className={cn("mb-4 flex gap-1 border-b border-slate-200", className)} role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={mode === "audit"}
      className={cn(
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        mode === "audit"
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800"
      )}
      onClick={() => onModeChange("audit")}
    >
      Журнал документов
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mode === "chain"}
      className={cn(
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        mode === "chain"
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800"
      )}
      onClick={() => onModeChange("chain")}
    >
      On-chain события
    </button>
  </div>
);
