import React from "react";

export type ActionItem = {
  id?: string;
  action_type: string;
  performed_at: string;
  details?: string | null;
  blockchain_tx_hash?: string | null;
};

export const actionLabels: Record<string, string> = {
  REGISTER: "Загрузка документа",
  REGISTER_ON_CHAIN: "Регистрация в блокчейне",
  VERIFY: "Проверка подлинности",
  TRANSFER_OWNERSHIP: "Передача владения",
  CREATE_LICENSE: "Создание лицензии",
  CHANGE_STATUS: "Изменение статуса",
};

export const ActionHistoryTimeline: React.FC<{ items: ActionItem[] }> = ({ items }) => {
  if (!items.length) return <div className="timeline-empty">Нет записей в истории действий.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((a, idx) => (
        <div className="timeline-item" key={a.id || idx}>
          <div className="timeline-item-content">
            <div className="timeline-item-type">
              {actionLabels[a.action_type] || a.action_type}
            </div>
            <div className="timeline-item-time">
              {new Date(a.performed_at).toLocaleString("ru-RU")}
            </div>
            {a.details && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{a.details}</div>}
            {a.blockchain_tx_hash && (
              <div style={{ marginTop: 6 }}>
                <span className="muted">Tx hash: </span>
                <code>{a.blockchain_tx_hash}</code>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

