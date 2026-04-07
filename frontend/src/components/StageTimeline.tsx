import React from "react";

export type StageTimelineProps = {
  status: string;
  processingStage?: number | null;
  createdAt: string;
  sha256Hash: string;
  departmentApprovedAt?: string | null;
  deaneryApprovedAt?: string | null;
  aiCheckStatus?: string;
  blockchainTxHash?: string | null;
  studentWalletAddress?: string | null;
  compact?: boolean;
};

function hashPreview(h: string): string {
  if (!h || h.length < 16) return h || "—";
  return `${h.slice(0, 16)}…`;
}

type StepKind = "done" | "active" | "pending" | "skipped";

/** Нормализация статусов бэкенда к этапам 1–5 */
function deriveSteps(
  status: string,
  processingStage: number | null | undefined,
  createdAt: string,
  sha256Hash: string,
  departmentApprovedAt: string | null | undefined,
  deaneryApprovedAt: string | null | undefined,
  aiCheckStatus: string | undefined,
  blockchainTxHash: string | null | undefined,
  studentWalletAddress: string | null | undefined
) {
  const st = status.toUpperCase();
  const hasChain = Boolean(blockchainTxHash);
  const ai = (aiCheckStatus || "skipped").toLowerCase();

  // Этап 1: фиксация
  const s1: StepKind = "done";

  // Этап 2: ИИ
  let s2: StepKind = "skipped";
  if (ai === "pending") s2 = "active";
  else if (ai === "passed") s2 = "done";
  else s2 = "skipped";

  // Этап 3: экспертиза
  let s3: StepKind = "pending";
  if (st === "UNDER_REVIEW" || st === "PENDING_APPROVAL") s3 = "active";
  if (departmentApprovedAt || deaneryApprovedAt) s3 = "active";
  if (
    ["APPROVED", "REGISTERED_ON_CHAIN", "TRANSFERRED"].includes(st) ||
    (departmentApprovedAt && deaneryApprovedAt)
  ) {
    s3 = "done";
  }
  if (st === "REJECTED") s3 = "active";

  // Этап 4: реестр
  let s4: StepKind = "pending";
  if (hasChain) s4 = "done";
  else if (st === "APPROVED") s4 = "active";

  // Этап 5: владелец
  let s5: StepKind = "pending";
  if (studentWalletAddress && hasChain) s5 = "done";
  else if (hasChain) s5 = "active";

  if (st === "TRANSFERRED" && hasChain) s5 = "done";

  // Полное завершение
  const allDone =
    s1 === "done" &&
    (s2 === "done" || s2 === "skipped") &&
    s3 === "done" &&
    s4 === "done" &&
    s5 === "done";
  if (allDone) {
    /* оставляем как есть */
  }

  const lines = [
    {
      n: 1,
      title: "Первичная фиксация",
      statusRu:
        s1 === "done"
          ? "Завершён"
          : s1 === "active"
            ? "Активен"
            : "Ожидание",
      body: `Файл загружен, хэш зафиксирован. ${new Date(createdAt).toLocaleString("ru-RU")}. Хэш: ${hashPreview(sha256Hash)}`,
      kind: s1,
    },
    {
      n: 2,
      title: "Проверка ИИ",
      statusRu: ai === "skipped" ? "Скоро" : ai === "pending" ? "В работе" : ai === "passed" ? "Пройдена" : "Пропущено",
      body: "Автоматический анализ документа (в разработке).",
      kind: s2,
      badge: ai === "skipped" ? "Скоро" : undefined,
    },
    {
      n: 3,
      title: "Экспертное подтверждение",
      statusRu:
        s3 === "done"
          ? "Завершён"
          : s3 === "active"
            ? "Активен"
            : "Ожидание",
      body: [
        departmentApprovedAt
          ? `✓ Кафедра: ${new Date(departmentApprovedAt).toLocaleString("ru-RU")}`
          : "○ Кафедра — ожидание",
        deaneryApprovedAt
          ? `✓ Деканат: ${new Date(deaneryApprovedAt).toLocaleString("ru-RU")}`
          : "○ Деканат — ожидание",
      ].join("\n"),
      kind: s3,
    },
    {
      n: 4,
      title: "Регистрация в реестре",
      statusRu: hasChain ? "Завершён" : st === "APPROVED" ? "Активен" : "Ожидание",
      body: blockchainTxHash
        ? `Транзакция: ${blockchainTxHash.slice(0, 14)}…`
        : "Запись в смарт-контракте после согласований.",
      kind: s4,
    },
    {
      n: 5,
      title: "Закрепление за владельцем",
      statusRu:
        studentWalletAddress && hasChain ? "Завершён" : hasChain ? "Активен" : "Ожидание",
      body: studentWalletAddress
        ? `Кошелёк выпускника: ${studentWalletAddress.slice(0, 12)}…`
        : "Привязка кошелька и QR для публичной проверки.",
      kind: s5,
    },
  ];

  return { lines, sysHint: processingStage ?? "—" };
}

function dotContent(kind: StepKind, n: number): React.ReactNode {
  if (kind === "done") return "✓";
  if (kind === "active") return "●";
  if (kind === "skipped") return "⟳";
  return "○";
}

export const StageTimeline: React.FC<StageTimelineProps> = ({
  status,
  processingStage,
  createdAt,
  sha256Hash,
  departmentApprovedAt,
  deaneryApprovedAt,
  aiCheckStatus,
  blockchainTxHash,
  studentWalletAddress,
  compact,
}) => {
  const { lines, sysHint } = deriveSteps(
    status,
    processingStage,
    createdAt,
    sha256Hash,
    departmentApprovedAt,
    deaneryApprovedAt,
    aiCheckStatus,
    blockchainTxHash,
    studentWalletAddress
  );

  return (
    <div className={`stage-timeline-v2 ${compact ? "stage-timeline-v2--compact" : ""}`}>
      <div className="stage-timeline-v2__title">Этапы обработки документа</div>
      {!compact && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
          Системный этап: {sysHint} / 5 · статус: {status}
        </p>
      )}
      <div>
        {lines.map((step) => (
          <div
            key={step.n}
            className={`stage-step stage-step--${step.kind === "skipped" ? "skipped" : step.kind === "done" ? "done" : step.kind === "active" ? "active" : "pending"}`}
          >
            <div className="stage-step__dot" aria-hidden>
              {dotContent(step.kind, step.n)}
            </div>
            <div>
              <div className="stage-step__head">
                <span className="stage-step__num">[{step.n}]</span>
                <span className="stage-step__title">{step.title}</span>
                {step.badge && <span className="stage-step__badge">{step.badge}</span>}
                <span className="stage-step__status" style={{ color: "var(--text-muted)" }}>
                  {step.statusRu}
                </span>
              </div>
              <div className="stage-step__desc" style={{ whiteSpace: "pre-line" }}>
                {step.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
