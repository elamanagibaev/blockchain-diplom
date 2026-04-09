import React from "react";

const LABELS: Record<string, string> = {
  UPLOADED: "Загружен",
  FROZEN: "Зафиксирован",
  UNDER_REVIEW: "На согласовании",
  PENDING_APPROVAL: "На согласовании",
  APPROVED: "Согласован",
  DEAN_APPROVED: "Согласован деканатом",
  REGISTERED: "В реестре (on-chain)",
  REGISTERED_ON_CHAIN: "В реестре",
  ASSIGNED_TO_OWNER: "Закреплён за выпускником",
  REJECTED: "Отклонён",
  TRANSFERRED: "Передан",
};

type Props = {
  status: string;
  onChain?: boolean;
};

export const DocumentStatusBadge: React.FC<Props> = ({ status, onChain }) => {
  const display =
    !onChain && (status === "REGISTERED" || status === "UPLOADED") ? "FROZEN" : status;
  const ru = LABELS[display] || display;
  let kind: "ok" | "warn" | "muted" | "bad" | "accent" = "muted";
  if (
    display === "REGISTERED_ON_CHAIN" ||
    display === "REGISTERED" ||
    display === "ASSIGNED_TO_OWNER"
  ) {
    kind = "ok";
  } else if (
    display === "APPROVED" ||
    display === "DEAN_APPROVED" ||
    display === "UNDER_REVIEW" ||
    display === "PENDING_APPROVAL"
  ) {
    kind = "warn";
  } else if (display === "REJECTED") kind = "bad";
  else if (display === "FROZEN" || display === "UPLOADED") kind = "accent";

  return <span className={`doc-status-badge doc-status-badge--${kind}`}>{ru}</span>;
};
