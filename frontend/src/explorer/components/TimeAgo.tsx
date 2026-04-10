import React, { useEffect, useMemo, useState } from "react";
import { formatRelativeRu } from "../utils/formatRelativeRu";
import { cn } from "@/lib/utils";

type TimeAgoProps = {
  /** ISO-время из БД (стабильное). */
  iso: string;
  className?: string;
};

/**
 * Относительное время; пересчёт не на каждый ререндер родителя, а по таймеру (раз в минуту).
 */
export const TimeAgo: React.FC<TimeAgoProps> = ({ iso, className }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const exact = useMemo(
    () =>
      new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [iso]
  );

  const relative = useMemo(() => formatRelativeRu(iso, Date.now()), [iso, tick]);

  return (
    <span className={cn("whitespace-nowrap text-sm text-slate-700", className)} title={exact}>
      {relative}
    </span>
  );
};
