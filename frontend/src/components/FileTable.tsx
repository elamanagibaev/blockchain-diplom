import React from "react";
import { Link } from "react-router-dom";

export type FileRow = {
  id: string;
  file_name: string;
  sha256_hash: string;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
};

import { StatusBadge } from "./StatusBadge";
import { Spinner } from "./Spinner";

const canSubmit = (status: string, hasTx: boolean) =>
  !hasTx && ["UPLOADED", "REGISTERED", "REJECTED"].includes(status);

export const FileTable: React.FC<{
  items: FileRow[];
  onSubmitForRegistration?: (id: string) => void;
  loadingId?: string | null;
}> = ({ items, onSubmitForRegistration, loadingId }) => {
  if (!items.length) {
    return <div className="timeline-empty">Нет документов для отображения.</div>;
  }
  return (
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Файл</th>
          <th>SHA-256</th>
          <th>Статус</th>
          <th>Создан</th>
          <th>В блокчейне</th>
          {onSubmitForRegistration && <th>Действие</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((f) => {
          const hasTx = Boolean(f.blockchain_tx_hash);
          const showSubmit = canSubmit(f.status, hasTx);
          return (
            <tr key={f.id}>
              <td>
                <Link to={`/files/${f.id}`}>{f.file_name}</Link>
              </td>
              <td>
                <code>{f.sha256_hash.slice(0, 12)}…</code>
              </td>
              <td>
                <StatusBadge
                  status={f.status === "REGISTERED" && !hasTx ? "UPLOADED" : f.status}
                />
              </td>
              <td>{new Date(f.created_at).toLocaleString()}</td>
              <td>
                {hasTx ? (
                  <span className="ok">YES</span>
                ) : (
                  <span className="muted">no</span>
                )}
              </td>
              {onSubmitForRegistration && (
                <td>
                  {showSubmit ? (
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      onClick={() => onSubmitForRegistration(f.id)}
                      disabled={loadingId === f.id}
                    >
                      {loadingId === f.id ? <Spinner size={14} /> : "Подать на регистрацию"}
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
    </div>
  );
};

