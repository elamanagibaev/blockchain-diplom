/** Ответ GET /admin/journal/document-events */

export type DocumentEventJournalApi = {
  id: string;
  document_id: string | null;
  action: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  document_file_name: string | null;
};

/** Ответ GET /blockchain/events */

export type BlockchainEventApi = {
  id: string;
  action_type: string;
  document_id: string;
  document_file_name: string | null;
  timestamp: string;
  tx_hash: string;
  from_wallet: string | null;
  to_wallet: string | null;
  initiator_user_id: string | null;
  initiator_email: string | null;
  tx_explorer_url: string | null;
};
