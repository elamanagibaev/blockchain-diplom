import React from "react";
import { getExplorerTxUrlOptional } from "../utils/blockExplorer";

export type BlockchainInfoCardProps = {
  txHash?: string | null;
  objectId?: string | null;
  /** Приоритет: URL из API (учёт сети на бэкенде); иначе VITE_BLOCK_EXPLORER_URL на клиенте */
  txExplorerUrl?: string | null;
};

export const BlockchainInfoCard: React.FC<BlockchainInfoCardProps> = ({ txHash, objectId, txExplorerUrl }) => {
  const hasTx = Boolean((txHash || "").trim());
  const fromApi = (txExplorerUrl || "").trim();
  const fromVite = hasTx ? getExplorerTxUrlOptional(txHash!) : "";
  const explorerHref = (fromApi || fromVite).trim();
  const canOpenExplorer = hasTx && Boolean(explorerHref);

  if (!txHash && !objectId) {
    return (
      <div className="blockchain-empty">
        <span className="muted">Документ ещё не зарегистрирован в блокчейне.</span>
        <span className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
          Подайте заявку на регистрацию выше, чтобы закрепить запись в смарт-контракте.
        </span>
        <button type="button" className="btn btn-outline btn-sm blockchain-explorer-btn" disabled style={{ marginTop: 10 }}>
          Открыть в обозревателе
        </button>
      </div>
    );
  }
  return (
    <div className={`blockchain-proof${txHash ? " blockchain-proof--onchain" : ""}`}>
      {objectId && (
        <div className="blockchain-proof-row">
          <span className="muted">Object ID:</span>
          <code className="mono-break">{objectId}</code>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigator.clipboard.writeText(objectId)}
          >
            Копировать
          </button>
        </div>
      )}
      {txHash && (
        <div className="blockchain-proof-row">
          <span className="muted">Tx hash:</span>
          <code className="mono-break">{txHash}</code>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigator.clipboard.writeText(txHash)}
          >
            Копировать
          </button>
        </div>
      )}
      {canOpenExplorer ? (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm blockchain-explorer-btn"
        >
          Открыть в обозревателе
        </a>
      ) : (
        <button type="button" className="btn btn-outline btn-sm blockchain-explorer-btn" disabled>
          Открыть в обозревателе
        </button>
      )}
    </div>
  );
};
