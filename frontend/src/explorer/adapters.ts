import type { AuditExplorerRow, ChainExplorerRow } from "./types";
import type { BlockchainEventApi, DocumentEventJournalApi } from "./api/types";
import { buildAuditExtra } from "./eventLabels";

function toIso(ts: string | Date): string {
  if (typeof ts === "string") return ts;
  return new Date(ts).toISOString();
}

function shortWallet(addr: string): string {
  const a = addr.trim();
  if (a.length < 20) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

/**
 * Нормализация строки document_events для таблицы /explorer.
 */
export function mapDocumentEventToExplorerRow(api: DocumentEventJournalApi): AuditExplorerRow {
  const docId = api.document_id;
  const hasDoc = Boolean(docId);
  const extra = buildAuditExtra(api.action, api.metadata);

  let initiator: AuditExplorerRow["initiator"] = null;
  if (api.user_email) {
    initiator = { kind: "user", display: api.user_email };
  } else if (api.user_id) {
    initiator = { kind: "user", display: api.user_id };
  } else {
    initiator = { kind: "service", display: "Система / анонимно" };
  }

  return {
    rowKind: "audit",
    id: api.id,
    action: api.action,
    documentId: docId,
    documentLabel: hasDoc ? api.document_file_name || docId! : null,
    timestamp: toIso(api.timestamp),
    initiator,
    extra,
    metadata: api.metadata,
  };
}

/**
 * Нормализация строки blockchain_events для таблицы /explorer.
 */
export function mapBlockchainEventToExplorerRow(api: BlockchainEventApi): ChainExplorerRow {
  const fromW = api.from_wallet;
  const toW = api.to_wallet;
  let extra = "—";
  if (api.action_type === "TRANSFER" && fromW && toW) {
    extra = `${shortWallet(fromW)} → ${shortWallet(toW)}`;
  } else if (api.action_type === "REGISTER" && toW) {
    extra = `On-chain владелец: ${shortWallet(toW)}`;
  }

  let initiator: ChainExplorerRow["initiator"] = null;
  if (api.initiator_email) {
    initiator = { kind: "user", display: api.initiator_email };
  } else if (api.initiator_user_id) {
    initiator = { kind: "user", display: api.initiator_user_id };
  }

  return {
    rowKind: "chain",
    id: api.id,
    actionType: api.action_type,
    documentId: api.document_id,
    documentLabel: api.document_file_name?.trim() || `${api.tx_hash.slice(0, 12)}…`,
    timestamp: toIso(api.timestamp),
    initiator,
    extra,
    txHash: api.tx_hash,
    fromWallet: fromW,
    toWallet: toW,
    txExplorerUrl: api.tx_explorer_url || undefined,
  };
}
