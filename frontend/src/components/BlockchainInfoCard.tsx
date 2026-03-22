import React from "react";

export type BlockchainInfoCardProps = {
  txHash?: string | null;
  objectId?: string | null;
};

export const BlockchainInfoCard: React.FC<BlockchainInfoCardProps> = ({ txHash, objectId }) => {
  if (!txHash && !objectId) {
    return (
      <div className="blockchain-empty">
        <span className="muted">Документ ещё не зарегистрирован в блокчейне.</span>
        <span className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
          Подайте заявку на регистрацию выше, чтобы закрепить запись в смарт-контракте.
        </span>
      </div>
    );
  }
  return (
    <div className="blockchain-proof">
      {objectId && (
        <div>
          <span className="muted">ID объекта в реестре:</span> <code>{objectId}</code>
        </div>
      )}
      {txHash && (
        <div>
          <span className="muted">Tx hash:</span> <code>{txHash}</code>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => navigator.clipboard.writeText(txHash)}
          >
            Копировать
          </button>
        </div>
      )}
      {txHash && (
        <a
          href={`https://explorer.local/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm"
        >
          Открыть в обозревателе
        </a>
      )}
    </div>
  );
};
