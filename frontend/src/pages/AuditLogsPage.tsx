import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Регистрация пользователя",
  USER_LOGIN: "Вход",
  DOCUMENT_UPLOAD: "Загрузка документа",
  BLOCKCHAIN_REGISTER: "Регистрация в блокчейне (успех)",
  BLOCKCHAIN_REGISTER_FAILED: "Регистрация в блокчейне (ошибка)",
  DOCUMENT_TRANSFER: "Передача документа",
};

type LogRow = {
  id: string;
  action_type: string;
  performed_at: string;
  actor_user_id: string | null;
  actor_wallet_address: string | null;
  target_document_id: string | null;
  from_wallet: string | null;
  to_wallet: string | null;
  status: string;
  details: string | null;
};

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<LogRow[]>("/audit/logs", { params: { limit: 100 } })
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Журнал действий"
        subtitle="Аудит операций в системе"
      />
      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: 24 }}>
            <Spinner size={32} />
          </div>
        ) : logs.length === 0 ? (
          <div className="muted">Нет записей в журнале</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Действие</th>
                  <th>Wallet</th>
                  <th>Статус</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.performed_at).toLocaleString("ru-RU")}</td>
                    <td>{ACTION_LABELS[l.action_type] || l.action_type}</td>
                    <td>
                      <code style={{ fontSize: 11 }}>
                        {l.actor_wallet_address
                          ? `${l.actor_wallet_address.slice(0, 10)}…`
                          : "—"}
                      </code>
                    </td>
                    <td>
                      <span className={l.status === "success" ? "ok" : "bad"}>{l.status}</span>
                    </td>
                    <td>
                      {l.from_wallet && l.to_wallet && (
                        <span className="muted">
                          {l.from_wallet.slice(0, 8)}… → {l.to_wallet.slice(0, 8)}…
                        </span>
                      )}
                      {l.details && !l.from_wallet && (
                        <span className="muted" style={{ fontSize: 12 }}>{l.details.slice(0, 40)}</span>
                      )}
                    </td>
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
