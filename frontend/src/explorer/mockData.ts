import type { AuditExplorerRow, ChainExplorerRow } from "./types";
import { buildAuditExtra } from "./eventLabels";

const docA = "a1b2c3d4-e5f6-7890-abcd-ef1111111111";
const docB = "b2c3d4e5-f6a7-8901-bcde-f22222222222";
const docC = "c3d4e5f6-a7b8-9012-cdef-333333333333";

/** Моки журнала приложения (document_events), близко к реальной схеме. */
export const MOCK_AUDIT_ROWS: AuditExplorerRow[] = [
  {
    rowKind: "audit",
    id: "ev-audit-001",
    action: "UPLOAD",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    initiator: {
      kind: "user",
      display: "department@university.edu",
    },
    metadata: { file_name: "patent_application_2024.pdf", size_bytes: 524288 },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-002",
    action: "FREEZE",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    initiator: { kind: "service", display: "pipeline:freeze" },
    metadata: { sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-003",
    action: "APPROVAL",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    initiator: { kind: "user", display: "department@university.edu" },
    metadata: { decision: "submitted", stage: "кафедра" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-004",
    action: "APPROVAL",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    initiator: { kind: "user", display: "dean@university.edu" },
    metadata: { decision: "dean_approved", stage: "деканат" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-005",
    action: "REGISTER",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    initiator: { kind: "service", display: "blockchain:register" },
    metadata: { tx_hash: "0xf3a2b1c4d5e6789012345678901234567890abcd1234567890abcdef123456" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-006",
    action: "VERIFY_REQUEST",
    documentId: docB,
    documentLabel: "certificate_scan.png",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    initiator: { kind: "user", display: "guest@example.com" },
    metadata: { channel: "публичная проверка" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-007",
    action: "VERIFY_SUCCESS",
    documentId: docB,
    documentLabel: "certificate_scan.png",
    timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
    initiator: { kind: "service", display: "verify-svc" },
    metadata: {},
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-008",
    action: "VERIFY_FAILED",
    documentId: docC,
    documentLabel: "unknown_doc.pdf",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    initiator: { kind: "service", display: "verify-svc" },
    metadata: { reason: "Хэш не найден в реестре" },
    extra: "",
  },
  {
    rowKind: "audit",
    id: "ev-audit-009",
    action: "APPROVAL",
    documentId: docC,
    documentLabel: "unknown_doc.pdf",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    initiator: { kind: "user", display: "admin@university.edu" },
    metadata: { decision: "rejected", note: "Неполный комплект" },
    extra: "",
  },
].map((row) => ({
  ...row,
  extra: row.extra || buildAuditExtra(row.action, row.metadata ?? null),
}));

/** Моки blockchain_events. */
export const MOCK_CHAIN_ROWS: ChainExplorerRow[] = [
  {
    rowKind: "chain",
    id: "ev-chain-001",
    actionType: "REGISTER",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    initiator: {
      kind: "wallet",
      display: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      href: "/profile/user?w=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    },
    txHash: "0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999",
    fromWallet: null,
    toWallet: null,
    extra: "Регистрация объекта в смарт-контракте",
  },
  {
    rowKind: "chain",
    id: "ev-chain-002",
    actionType: "TRANSFER",
    documentId: docB,
    documentLabel: "certificate_scan.png",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    initiator: {
      kind: "user",
      display: "owner@student.edu",
    },
    txHash: "0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000",
    fromWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    toWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    extra: "",
  },
  {
    rowKind: "chain",
    id: "ev-chain-003",
    actionType: "TRANSFER",
    documentId: docA,
    documentLabel: "patent_application_2024.pdf",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    initiator: null,
    txHash: "0xabcdef00112233445566778899aabbccddeeff00112233445566778899aabb",
    fromWallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    toWallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    extra: "",
  },
].map((row) => {
  if (row.extra) return row;
  if (row.actionType === "TRANSFER" && row.fromWallet && row.toWallet) {
    const f = `${row.fromWallet.slice(0, 8)}…${row.fromWallet.slice(-6)}`;
    const t = `${row.toWallet.slice(0, 8)}…${row.toWallet.slice(-6)}`;
    return { ...row, extra: `${f} → ${t}` };
  }
  return { ...row, extra: row.txHash ? `tx ${row.txHash.slice(0, 10)}…` : "—" };
});
