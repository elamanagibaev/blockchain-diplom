import React from "react";
import { cn } from "@/lib/utils";

type EventTypeBadgeProps = {
  label: string;
  className?: string;
};

/** Нейтральный бейдж типа события (журнал / аудит). */
export const EventTypeBadge: React.FC<EventTypeBadgeProps> = ({ label, className }) => (
  <span
    className={cn(
      "inline-flex max-w-full items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800",
      className
    )}
  >
    {label}
  </span>
);
