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
  /** Подсветка этапов 4–5 во время автоматической финализации после деканата */
  highlightAutomation?: boolean;
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
  const postDeanStatuses = [
    "DEAN_APPROVED",
    "APPROVED",
    "REGISTERED",
    "REGISTERED_ON_CHAIN",
    "ASSIGNED_TO_OWNER",
    "TRANSFERRED",
  ];

  // Этап 1: фиксация
  const s1: StepKind = "done";

  // Этап 2: ИИ
  let s2: StepKind = "skipped";
  if (ai === "pending") s2 = "active";
  else if (ai === "passed") s2 = "done";
  else s2 = "skipped";

  // Этап 3: одно согласование деканатом (без отдельного этапа кафедры в workflow)
  let s3: StepKind = "pending";
  if (st === "UNDER_REVIEW" || st === "PENDING_APPROVAL") s3 = "active";
  if (deaneryApprovedAt || postDeanStatuses.includes(st)) {
    s3 = "done";
  }
  if (st === "REJECTED") s3 = "active";

  // Этап 4: реестр (после деканата — автоматически)
  let s4: StepKind = "pending";
  if (hasChain) s4 = "done";
  else if (st === "DEAN_APPROVED" || st === "APPROVED") s4 = "active";

  // Этап 5: владелец (автоматически тем же кошельком, что при загрузке)
  let s5: StepKind = "pending";
  if (st === "ASSIGNED_TO_OWNER") s5 = "done";
  else if (st === "TRANSFERRED" && hasChain) s5 = "done";
  else if (hasChain && studentWalletAddress) s5 = "done";
  else if (hasChain && (st === "REGISTERED" || st === "REGISTERED_ON_CHAIN")) s5 = "active";

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
      title: "Согласование деканата",
      statusRu:
        s3 === "done"
          ? "Завершён"
          : s3 === "active"
            ? "Активен"
            : "Ожидание",
      body: deaneryApprovedAt
        ? `✓ Деканат: ${new Date(deaneryApprovedAt).toLocaleString("ru-RU")}`
        : "○ Деканат — проверка и подтверждение",
      kind: s3,
    },
    {
      n: 4,
      title: "Регистрация в реестре",
      statusRu: hasChain
        ? "Завершено"
        : st === "DEAN_APPROVED" || st === "APPROVED"
          ? "Выполняется"
          : "Ожидание",
      body: blockchainTxHash
        ? `Транзакция: ${blockchainTxHash.slice(0, 14)}…`
        : deaneryApprovedAt || st === "DEAN_APPROVED" || st === "APPROVED"
          ? "Автоматически после согласования деканата (запись хэша в смарт-контракт)."
          : "Запись в смарт-контракте после согласования деканата.",
      kind: s4,
      badge: deaneryApprovedAt || st === "DEAN_APPROVED" || st === "APPROVED" ? "Авто" : undefined,
    },
    {
      n: 5,
      title: "Закрепление за владельцем",
      statusRu:
        st === "ASSIGNED_TO_OWNER" || (st === "TRANSFERRED" && hasChain)
          ? "Завершено"
          : hasChain && studentWalletAddress
            ? "Завершено"
            : hasChain
              ? "Выполняется"
              : "Ожидание",
      body: studentWalletAddress
        ? `Кошелёк выпускника: ${studentWalletAddress.slice(0, 12)}…`
        : "Автоматическая привязка кошелька из данных загрузки и QR для публичной проверки.",
      kind: s5,
      badge: deaneryApprovedAt || st === "DEAN_APPROVED" || st === "APPROVED" ? "Авто" : undefined,
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
  highlightAutomation,
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
            className={`stage-step stage-step--${step.kind === "skipped" ? "skipped" : step.kind === "done" ? "done" : step.kind === "active" ? "active" : "pending"}${
              highlightAutomation && (step.n === 4 || step.n === 5) ? " stage-step--automation" : ""
            }`}
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
