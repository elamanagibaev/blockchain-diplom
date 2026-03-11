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

export const FileTable: React.FC<{ items: FileRow[]; onRegister?: (id: string) => void; loadingId?: string | null }> = ({ items, onRegister, loadingId }) => {
  if (!items.length) {
    return <div className="timeline-empty">Нет документов для отображения.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Файл</th>
          <th>SHA-256</th>
          <th>Статус</th>
          <th>Создан</th>
          <th>В блокчейне</th>
          {onRegister && <th>Действие</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((f) => (
          <tr key={f.id}>
            <td>
              <Link to={`/files/${f.id}`}>{f.file_name}</Link>
            </td>
            <td>
              <code>{f.sha256_hash.slice(0, 12)}…</code>
            </td>
            <td>
              <StatusBadge
                status={f.status === "REGISTERED" && !f.blockchain_tx_hash ? "PENDING_ON_CHAIN" : f.status}
              />
            </td>
            <td>{new Date(f.created_at).toLocaleString()}</td>
            <td>
              {f.blockchain_tx_hash ? (
                <span className="ok">YES</span>
              ) : (
                <span className="muted">no</span>
              )}
            </td>
            {onRegister && (
              <td>
                {!f.blockchain_tx_hash ? (
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => onRegister(f.id)}
                    disabled={loadingId === f.id}
                  >
                    {loadingId === f.id ? <Spinner size={14} /> : "Зарегистрировать"}
                  </button>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

