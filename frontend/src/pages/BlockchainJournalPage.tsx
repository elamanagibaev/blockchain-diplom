import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";

type BlockchainEvent = {
  id: string;
  action_type: string;
  document_id: string;
  document_file_name: string | null;
  timestamp: string;
  tx_hash: string;
  from_wallet: string | null;
  to_wallet: string | null;
  initiator_user_id: string | null;
};

export const BlockchainJournalPage: React.FC = () => {
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<BlockchainEvent[]>("/blockchain/events")
      .then((r) => setEvents(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Ошибка загрузки журнала"))
      .finally(() => setLoading(false));
  }, []);

  const actionLabel = (t: string) => (t === "REGISTER" ? "Регистрация" : "Передача");

  return (
    <div className="page">
      <PageHeader
        title="Журнал блокчейна"
        subtitle="Глобальный реестр событий: регистрация и передача документов"
      />
      <div className="card">
        {error && (
          <div className="bad" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-center" style={{ padding: "24px 0" }}>
            <Spinner size={32} />
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Нет событий</div>
            <div className="muted" style={{ marginTop: 4 }}>
              События блокчейна появятся после регистрации или передачи документов.
            </div>
          </div>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Тип события</th>
                <th>Документ</th>
                <th>From Wallet</th>
                <th>To Wallet</th>
                <th>Tx Hash</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="status-badge" style={{ background: "var(--color-accent)", color: "white" }}>
                      {actionLabel(e.action_type)}
                    </span>
                  </td>
                  <td>{e.document_file_name || e.document_id}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{e.from_wallet ? `${e.from_wallet.slice(0, 10)}…` : "—"}</code>
                  </td>
                  <td>
                    <code style={{ fontSize: 11 }}>{e.to_wallet ? `${e.to_wallet.slice(0, 10)}…` : "—"}</code>
                  </td>
                  <td>
                    <code style={{ fontSize: 11 }}>{e.tx_hash.slice(0, 18)}…</code>
                  </td>
                  <td>{new Date(e.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};
