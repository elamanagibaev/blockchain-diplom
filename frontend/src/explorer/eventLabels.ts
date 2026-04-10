/**
 * Маппинг кодов событий → подписи для бейджа и UI (русский язык).
 */

/** Подпись типа для audit-события с учётом metadata (решение, этап и т.д.). */
export function getAuditEventLabel(
  action: string,
  metadata?: Record<string, unknown> | null
): string {
  const m = metadata ?? undefined;
  switch (action) {
    case "UPLOAD":
      return "Загрузка файла";
    case "FREEZE":
      return "Фиксация хэша";
    case "APPROVAL": {
      const decision = String(m?.decision ?? "").toLowerCase();
      if (decision === "rejected" || decision === "reject") return "Отклонение";
      if (decision === "dean_approved" || decision === "dean") return "Подтверждение деканатом";
      if (decision === "submitted" || decision === "to_review") return "Отправка на согласование";
      return "Согласование";
    }
    case "APPROVAL_COMPLETED":
      return "Согласование завершено";
    case "REGISTER":
      return "Запись в блокчейн";
    case "VERIFY":
      return "Верификация";
    case "VERIFY_REQUEST":
      return "Запрос верификации";
    case "VERIFY_SUCCESS":
      return "Верификация успешна";
    case "VERIFY_FAILED":
      return "Верификация не пройдена";
    default:
      return action || "Событие";
  }
}

/** Подпись для on-chain типа. */
export function getChainEventLabel(actionType: string): string {
  switch (actionType) {
    case "REGISTER":
      return "Запись в блокчейн";
    case "TRANSFER":
      return "Передача";
    default:
      return actionType || "On-chain";
  }
}

/** Текст колонки «Дополнительно» для audit (если не задан явно в данных). */
export function buildAuditExtra(
  action: string,
  metadata?: Record<string, unknown> | null
): string {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  switch (action) {
    case "VERIFY_SUCCESS":
      return "Результат: подлинность подтверждена";
    case "VERIFY_FAILED": {
      const reason = metadata.reason ?? metadata.detail;
      return reason ? `Причина: ${String(reason)}` : "Результат: не пройдена";
    }
    case "VERIFY_REQUEST":
      return metadata.channel ? `Канал: ${String(metadata.channel)}` : "Запрос на проверку";
    case "APPROVAL": {
      const note = metadata.note ?? metadata.comment;
      const stage = metadata.stage;
      const parts: string[] = [];
      if (stage) parts.push(`Этап: ${String(stage)}`);
      if (note) parts.push(String(note));
      return parts.length ? parts.join(" · ") : "—";
    }
    case "UPLOAD": {
      const fn = metadata.file_name ?? metadata.fileName;
      return fn ? `Файл: ${String(fn)}` : "—";
    }
    case "REGISTER":
      return metadata.tx_hash ? `tx: ${String(metadata.tx_hash).slice(0, 18)}…` : "—";
    default:
      return "—";
  }
}
