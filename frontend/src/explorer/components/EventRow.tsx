import React from "react";
import { Eye } from "lucide-react";
import type { ExplorerRow } from "../types";
import { resolveInitiatorHref } from "../utils/initiatorHref";
import { getExplorerTxUrlOptional } from "@/utils/blockExplorer";
import { getAuditEventLabel, getChainEventLabel } from "../eventLabels";
import { EventTypeBadge } from "./EventTypeBadge";
import { EntityLink } from "./EntityLink";
import { TimeAgo } from "./TimeAgo";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

type EventRowProps = {
  row: ExplorerRow;
  onView: (row: ExplorerRow) => void;
  className?: string;
};

function initiatorTitle(kind: string): string {
  if (kind === "user") return "Пользователь";
  if (kind === "wallet") return "Кошелёк";
  return "Сервис";
}

export const EventRow: React.FC<EventRowProps> = ({ row, onView, className }) => {
  const typeLabel =
    row.rowKind === "audit"
      ? getAuditEventLabel(row.action, row.metadata)
      : getChainEventLabel(row.actionType);

  const isAuditNoDoc = row.rowKind === "audit" && !row.documentId;
  const docHref = row.documentId ? `/files/${row.documentId}` : undefined;
  const docTitle = row.documentLabel || row.documentId || "—";

  const ini = row.initiator;

  const chainTxHref =
    row.rowKind === "chain"
      ? row.txExplorerUrl?.trim() || getExplorerTxUrlOptional(row.txHash)
      : "";

  return (
    <tr
      className={cn(
        "h-11 border-b border-slate-100 transition-colors hover:bg-slate-50/90",
        className
      )}
    >
      <td className="w-11 px-2 align-middle">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-slate-900"
          aria-label="Просмотр деталей события"
          onClick={() => onView(row)}
        >
          <Eye className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </td>
      <td className="max-w-[200px] px-2 align-middle">
        <EventTypeBadge label={typeLabel} />
      </td>
      <td className="max-w-[280px] px-2 align-middle">
        {isAuditNoDoc ? (
          <span className="text-sm text-slate-400" title="Верификация или событие без document_id в БД">
            Нет документа
          </span>
        ) : row.rowKind === "chain" ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <EntityLink href={docHref} title={row.documentId}>
              {docTitle}
            </EntityLink>
            {chainTxHref ? (
              <a
                href={chainTxHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Транзакция
              </a>
            ) : null}
          </div>
        ) : (
          <EntityLink href={docHref} title={row.documentId ?? undefined}>
            {docTitle}
          </EntityLink>
        )}
      </td>
      <td className="whitespace-nowrap px-2 align-middle">
        <TimeAgo iso={row.timestamp} />
      </td>
      <td className="max-w-[220px] px-2 align-middle">
        {ini ? (
          <EntityLink
            href={resolveInitiatorHref(ini)}
            title={`${initiatorTitle(ini.kind)}: ${ini.display}`}
          >
            {ini.display}
          </EntityLink>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </td>
      <td className="min-w-[200px] max-w-md px-2 align-middle">
        <span className="block truncate text-sm text-slate-600" title={row.extra}>
          {row.extra || "—"}
        </span>
      </td>
    </tr>
  );
};
