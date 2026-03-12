import React from "react";
import { Link } from "react-router-dom";

export type ActivityItem = {
  id: string;
  action_type: string;
  performed_at: string;
  file_name: string;
  object_id: string;
  details?: string | null;
};

const actionIcons: Record<string, string> = {
  REGISTER: "📄",
  REGISTER_ON_CHAIN: "⛓",
  TRANSFER: "↗",
  TRANSFER_OWNERSHIP: "↗",
  SUBMIT_FOR_REGISTRATION: "📤",
  VERIFY: "✓",
  CREATE_LICENSE: "📜",
  CHANGE_STATUS: "🔄",
};

const actionLabels: Record<string, string> = {
  REGISTER: "Загрузка",
  REGISTER_ON_CHAIN: "В блокчейне",
  TRANSFER: "Передача",
  TRANSFER_OWNERSHIP: "Передача",
  SUBMIT_FOR_REGISTRATION: "На рассмотрение",
  VERIFY: "Проверка",
  CREATE_LICENSE: "Лицензия",
  CHANGE_STATUS: "Статус",
};

export const ActivityList: React.FC<{
  items: ActivityItem[];
  emptyMessage?: string;
  maxItems?: number;
}> = ({ items, emptyMessage = "Нет действий", maxItems = 8 }) => {
  const displayed = maxItems ? items.slice(0, maxItems) : items;

  if (!displayed.length) {
    return (
      <div className="activity-list-empty">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="activity-list">
      {displayed.map((a) => (
        <div key={a.id} className="activity-list-item">
          <span className="activity-list-icon">
            {actionIcons[a.action_type] || "•"}
          </span>
          <div className="activity-list-content">
            <span className="activity-list-type">
              {actionLabels[a.action_type] || a.action_type}
            </span>
            <Link to={`/files/${a.object_id}`} className="activity-list-doc">
              {a.file_name}
            </Link>
            <span className="activity-list-time">
              {new Date(a.performed_at).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
