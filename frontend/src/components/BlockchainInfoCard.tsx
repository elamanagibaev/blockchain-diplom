import React from "react";

export type BlockchainInfoCardProps = {
  txHash?: string | null;
  objectId?: string | null;
};

export const BlockchainInfoCard: React.FC<BlockchainInfoCardProps> = ({ txHash, objectId }) => {
  if (!txHash && !objectId) {
    return <div className="muted">Документ ещё не зарегистрирован на блокчейне.</div>;
  }
  return (
    <div className="grid" style={{ gap: 8 }}>
      {txHash && (
        <div>
          <span className="muted">Tx hash:</span> <code>{txHash}</code>
        </div>
      )}
      {objectId && (
        <div>
          <span className="muted">Object ID:</span> <code>{objectId}</code>
        </div>
      )}
      {txHash && (
        <div>
          <a
            href={`https://explorer.local/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ fontSize: 12 }}
          >
            View on explorer
          </a>
        </div>
      )}
    </div>
  );
};
