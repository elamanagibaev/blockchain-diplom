import React from "react";
import { Link } from "react-router-dom";

export type FileRow = {
  id: string;
  file_name: string;
  title?: string | null;
  description?: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
};

import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { Spinner } from "./ui/Spinner";
import { BlockchainOnChainIcon } from "./BlockchainOnChainIcon";

/** Legacy: UPLOADED / REGISTERED без tx → показываем как FROZEN («черновик»). */
export function patentDisplayStatus(status: string, hasTx: boolean): string {
  if (!hasTx && (status === "REGISTERED" || status === "UPLOADED")) return "FROZEN";
  return status;
}

export function canSubmitForRegistration(status: string, hasTx: boolean): boolean {
  return !hasTx && ["FROZEN", "UPLOADED", "REGISTERED", "REJECTED"].includes(status);
}

function documentDisplayName(f: FileRow): string {
  const d = f.description?.trim();
  if (d) return d;
  const t = f.title?.trim();
  if (t) return t;
  return f.file_name;
}

export const FileTable: React.FC<{
  items: FileRow[];
  onSubmitForRegistration?: (id: string) => void;
  loadingId?: string | null;
}> = ({ items, onSubmitForRegistration, loadingId }) => {
  if (!items.length) {
    return <div className="timeline-empty">Нет документов для отображения.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Документ</th>
          <th>Статус</th>
          <th>Создан</th>
          <th>Блокчейн</th>
          {onSubmitForRegistration && <th>Действие</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((f) => {
          const hasTx = Boolean(f.blockchain_tx_hash);
          const showSubmit = canSubmitForRegistration(f.status, hasTx);
          const name = documentDisplayName(f);
          const missingDescription = !f.description?.trim();
          return (
            <tr key={f.id}>
              <td>
                <div>
                  <Link to={`/files/${f.id}`}>{name}</Link>
                  {missingDescription && (
                    <div className="file-row-desc-hint">Добавьте название документа</div>
                  )}
                </div>
              </td>
              <td>
                <DocumentStatusBadge status={f.status} onChain={hasTx} />
              </td>
              <td>{new Date(f.created_at).toLocaleString()}</td>
              <td>
                <BlockchainOnChainIcon onChain={hasTx} />
              </td>
              {onSubmitForRegistration && (
                <td>
                  {showSubmit ? (
                    <button
                      type="button"
                      className="btn-review"
                      onClick={() => onSubmitForRegistration(f.id)}
                      disabled={loadingId === f.id}
                    >
                      {loadingId === f.id ? <Spinner size={14} /> : "Рассмотреть"}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
