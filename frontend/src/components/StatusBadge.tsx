import React from "react";

export type StatusBadgeProps = {
  status: string;
  /** Переопределение отображаемого текста */
  label?: string;
  /**
   * «patents» — подписи для списка «Мои патенты» (Черновик, На проверке, Мой, Получен).
   * Остальные страницы — «default».
   */
  labelPreset?: "default" | "patents";
};

export type SoftBadgeVariant = "registered" | "sale" | "reject" | "review" | "muted";

/** Соответствует модификаторам `.soft-badge--*` в index.html (как в «Реестре»). */
export function statusToSoftVariant(status: string): SoftBadgeVariant {
  switch (status) {
    case "REGISTERED_ON_CHAIN":
    case "VERIFIED":
    case "OK":
      return "registered";
    case "TRANSFERRED":
      return "sale";
    case "REJECTED":
    case "NOT_VERIFIED":
    case "INVALID_HASH":
    case "INVALID_ON_CHAIN":
      return "reject";
    case "PENDING_APPROVAL":
    case "PENDING_ON_CHAIN":
    case "UNDER_REVIEW":
    case "APPROVED":
      return "review";
    case "FROZEN":
    case "UPLOADED":
    case "REGISTERED":
      return "muted";
    case "NOT_FOUND":
    case "DRAFT":
    default:
      return "muted";
  }
}

const statusLabelsRu: Record<string, string> = {
  FROZEN: "Заморожен",
  UPLOADED: "Загружен",
  REGISTERED: "Загружен",
  PENDING_APPROVAL: "На рассмотрении",
  UNDER_REVIEW: "На рассмотрении",
  APPROVED: "Готов к финальной регистрации",
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

/** Подписи для вкладки «Мои патенты» + карточка документа / загрузка в том же контексте. */
const patentLabelsRu: Partial<Record<string, string>> = {
  FROZEN: "Черновик",
  UPLOADED: "Черновик",
  REGISTERED: "Черновик",
  PENDING_APPROVAL: "На проверке",
  UNDER_REVIEW: "На проверке",
  PENDING_ON_CHAIN: "На проверке",
  APPROVED: "Готов к финальной регистрации",
  REGISTERED_ON_CHAIN: "Мой",
  TRANSFERRED: "Получен",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, labelPreset = "default" }) => {
  const variant = statusToSoftVariant(status);
  const text =
    label ??
    (labelPreset === "patents" && patentLabelsRu[status] != null
      ? patentLabelsRu[status]!
      : statusLabelsRu[status]) ??
    status.replace(/_/g, " ");
  return <span className={`soft-badge soft-badge--${variant}`}>{text}</span>;
};
