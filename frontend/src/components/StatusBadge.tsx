import React from "react";

export type StatusBadgeProps = {
  status: string;
  /** Переопределение отображаемого текста (по ТЗ: Uploaded, Pending On-Chain, Registered, Verified, Rejected) */
  label?: string;
};

const statusColors: Record<string, string> = {
  UPLOADED: "--color-primary",
  REGISTERED: "--color-primary",
  PENDING_APPROVAL: "#f59e0b",
  REGISTERED_ON_CHAIN: "--color-accent",
  PENDING_ON_CHAIN: "--color-primary",
  VERIFIED: "--color-success",
  NOT_VERIFIED: "--color-danger",
  TRANSFERRED: "--color-accent",
  DRAFT: "#9ca3af",
  REJECTED: "--color-danger",
  OK: "--color-success",
  NOT_FOUND: "--color-danger",
  INVALID_HASH: "--color-danger",
};

const statusLabelsRu: Record<string, string> = {
  UPLOADED: "Загружен",
  REGISTERED: "Загружен",
  PENDING_APPROVAL: "На рассмотрении",
  REGISTERED_ON_CHAIN: "В блокчейне",
  PENDING_ON_CHAIN: "Ожидает on-chain",
  VERIFIED: "Верифицирован",
  NOT_VERIFIED: "Не верифицирован",
  TRANSFERRED: "Передан",
  DRAFT: "Черновик",
  REJECTED: "Отклонён",
  OK: "Целостность ОК",
  NOT_FOUND: "Не найден",
  INVALID_HASH: "Неверный хэш",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const bg = statusColors[status] || "--color-muted";
  const text = label ?? statusLabelsRu[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className="status-badge"
      style={{
        background: `var(${bg})`,
        color: "white",
        padding: "3px 8px",
        borderRadius: "8px",
        fontSize: "12px",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  );
};
