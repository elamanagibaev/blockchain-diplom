/**
 * Строки внутреннего журнала: аудит приложения и on-chain события (разные модели данных).
 */

export type InitiatorKind = "user" | "service" | "wallet";

/** Инициатор события: отображаемое имя и опциональная ссылка. */
export type InitiatorRef = {
  kind: InitiatorKind;
  display: string;
  href?: string;
};

/** Событие из document_events (журнал приложения). */
export type AuditExplorerRow = {
  rowKind: "audit";
  id: string;
  /** Код из БД: UPLOAD, FREEZE, APPROVAL, … */
  action: string;
  /** NULL — например VERIFY_* до привязки к документу. */
  documentId: string | null;
  documentLabel: string | null;
  timestamp: string;
  initiator: InitiatorRef | null;
  /** Текст колонки «Дополнительно» (уже сформированный или из metadata на клиенте). */
  extra: string;
  metadata?: Record<string, unknown> | null;
};

/** Событие из blockchain_events. */
export type ChainExplorerRow = {
  rowKind: "chain";
  id: string;
  actionType: string;
  documentId: string;
  documentLabel: string;
  timestamp: string;
  initiator: InitiatorRef | null;
  extra: string;
  txHash: string;
  fromWallet: string | null;
  toWallet: string | null;
  /** Ссылка из API (BLOCK_EXPLORER_URL) или дополняется на клиенте. */
  txExplorerUrl?: string | null;
};

export type ExplorerRow = AuditExplorerRow | ChainExplorerRow;

export type ExplorerMode = "audit" | "chain";
