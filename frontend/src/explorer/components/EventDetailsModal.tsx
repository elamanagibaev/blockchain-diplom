import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { ExplorerRow } from "../types";
import { getAuditEventLabel, getChainEventLabel } from "../eventLabels";
import { TimeAgo } from "./TimeAgo";
import { EntityLink } from "./EntityLink";
import { resolveInitiatorHref } from "../utils/initiatorHref";
import { getExplorerTxUrlOptional } from "@/utils/blockExplorer";

type EventDetailsModalProps = {
  row: ExplorerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Детали одной записи журнала (поля + сырые данные для отладки). */
export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ row, open, onOpenChange }) => {
  const title = row
    ? row.rowKind === "audit"
      ? getAuditEventLabel(row.action, row.metadata)
      : getChainEventLabel(row.actionType)
    : "Событие";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {row ? `Идентификатор события: ${row.id}` : "Нет выбранной записи"}
          </DialogDescription>
        </DialogHeader>

        {row ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Документ</dt>
            <dd>
              {row.rowKind === "audit" && !row.documentId ? (
                <span className="text-slate-500">Не привязано (например, верификация до сопоставления)</span>
              ) : (
                <EntityLink href={`/files/${row.documentId}`} title={row.documentId ?? undefined}>
                  {row.documentLabel || row.documentId}
                </EntityLink>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Время</dt>
            <dd className="text-slate-900">
              {new Date(row.timestamp).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              (<TimeAgo iso={row.timestamp} />)
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Инициатор</dt>
            <dd className="text-slate-900">
              {row.initiator ? (
                <EntityLink href={resolveInitiatorHref(row.initiator)}>
                  {row.initiator.display} ({row.initiator.kind})
                </EntityLink>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Дополнительно</dt>
            <dd className="break-words text-slate-800">{row.extra || "—"}</dd>
          </div>

          {row.rowKind === "audit" && (
            <div>
              <dt className="text-xs font-medium text-slate-500">Код действия (БД)</dt>
              <dd className="font-mono text-xs text-slate-700">{row.action}</dd>
            </div>
          )}

          {row.rowKind === "chain" && (
            <>
              <div>
                <dt className="text-xs font-medium text-slate-500">Тип on-chain</dt>
                <dd className="font-mono text-xs text-slate-700">{row.actionType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Транзакция</dt>
                <dd className="break-all font-mono text-xs text-slate-700">
                  {row.txHash}
                  {(() => {
                    const href =
                      row.txExplorerUrl?.trim() || getExplorerTxUrlOptional(row.txHash);
                    return href ? (
                      <>
                        {" "}
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Открыть в обозревателе
                        </a>
                      </>
                    ) : null;
                  })()}
                </dd>
              </div>
              {(row.fromWallet || row.toWallet) && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Кошельки</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">
                    {row.fromWallet ?? "—"} → {row.toWallet ?? "—"}
                  </dd>
                </div>
              )}
            </>
          )}

          {row.rowKind === "audit" && row.metadata && Object.keys(row.metadata).length > 0 && (
            <div>
              <dt className="mb-1 text-xs font-medium text-slate-500">Метаданные (JSON)</dt>
              <dd>
                <pre className="max-h-40 overflow-auto rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </dd>
            </div>
          )}
        </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
