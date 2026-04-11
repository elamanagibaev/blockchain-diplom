import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { canSubmitForRegistration } from "../components/FileTable";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { Spinner } from "../components/ui/Spinner";
import { BlockchainInfoCard } from "../components/BlockchainInfoCard";
import { StageTimeline } from "../components/StageTimeline";

type Data = {
  id: string;
  file_name: string;
  mime_type?: string;
  title?: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  description?: string | null;
  blockchain_object_id?: string | null;
  blockchain_tx_hash?: string | null;
  tx_explorer_url?: string | null;
  blockchain_registered_at?: string | null;
  owner_id: string;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
  uploaded_by_id?: string | null;
  uploaded_by_email?: string | null;
  uploaded_by_wallet_address?: string | null;
  storage_key?: string;
  document_type?: string | null;
  processing_stage?: number | null;
  department_approved_at?: string | null;
  deanery_approved_at?: string | null;
  ai_check_status?: string;
  student_wallet_address?: string | null;
};

type ApprovalStage = {
  stage_id: number;
  stage_code: string;
  title: string;
  stage_order: number;
  allowed_roles: string[];
  state: "PENDING" | "CURRENT" | "APPROVED" | "REJECTED";
  acted_by?: string | null;
  acted_at?: string | null;
  comment?: string | null;
  can_act: boolean;
};

type ApprovalPayload = {
  document_id: string;
  document_status: string;
  current_stage_code?: string | null;
  all_stages_completed: boolean;
  ready_for_final_registration?: boolean;
  stages: ApprovalStage[];
};

type DocEvent = {
  id: string;
  action: string;
  timestamp: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  UPLOAD: "Загрузка",
  FREEZE: "Фиксация хэша",
  APPROVAL: "Согласование",
  APPROVAL_COMPLETED: "Согласование завершено",
  REGISTER: "Регистрация в сети",
  VERIFY: "Верификация",
  VERIFY_REQUEST: "Запрос проверки",
  VERIFY_SUCCESS: "Проверка успешна",
  VERIFY_FAILED: "Проверка не пройдена",
};

function formatEventAction(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function hashShort(h: string): string {
  if (!h || h.length < 20) return h;
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

function eventSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "—";
  const step = typeof meta.step === "string" ? meta.step : null;
  const decision = typeof meta.decision === "string" ? meta.decision : null;
  const tx = typeof meta.tx_hash === "string" ? meta.tx_hash : null;
  if (step && tx) return `${step} · ${tx.slice(0, 12)}…`;
  if (step && decision) return `${step} · ${decision}`;
  if (step) return step;
  if (tx) return `tx ${tx.slice(0, 12)}…`;
  return "подробности в JSON";
}

export const FileDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferWallet, setTransferWallet] = useState("");
  const [studentWallet, setStudentWallet] = useState("");
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(false);
  const [approval, setApproval] = useState<ApprovalPayload | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [finalRegistering, setFinalRegistering] = useState(false);
  const [events, setEvents] = useState<DocEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const { notify } = useNotification();
  const { user } = useAuth();

  const publicVerifyUrl = useMemo(() => {
    if (typeof window === "undefined" || !data?.id) return "";
    return `${window.location.origin}/verify/doc/${data.id}`;
  }, [data?.id]);

  const handleOpenDocumentInNewTab = async () => {
    if (!id || !data) return;
    setOpeningDoc(true);
    try {
      const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
      const mime =
        (typeof res.headers["content-type"] === "string" && res.headers["content-type"]) ||
        data.mime_type ||
        "application/octet-stream";
      const blob = new Blob([res.data], { type: mime });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      notify("success", "Документ открыт в новой вкладке");
    } catch (err: any) {
      let msg = "Не удалось открыть документ";
      const errData = err?.response?.data;
      if (errData instanceof Blob) {
        try {
          const text = await errData.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || msg;
        } catch {
          /* ignore */
        }
      } else if (typeof errData?.detail === "string") {
        msg = errData.detail;
      } else if (Array.isArray(errData?.detail)) {
        msg = errData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
      }
      notify("error", msg);
    } finally {
      setOpeningDoc(false);
    }
  };

  const handleDownload = async () => {
    if (!id || !data) return;
    setDownloading(true);
    try {
      const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file_name || "document";
      a.click();
      URL.revokeObjectURL(url);
      notify("success", "Файл скачан");
    } catch (err: any) {
      let msg = "Ошибка скачивания";
      const errData = err?.response?.data;
      if (errData instanceof Blob) {
        try {
          const text = await errData.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || msg;
        } catch {
          /* ignore */
        }
      } else if (typeof errData?.detail === "string") {
        msg = errData.detail;
      } else if (Array.isArray(errData?.detail)) {
        msg = errData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
      }
      notify("error", msg);
    } finally {
      setDownloading(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Data>(`/files/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const loadApproval = async () => {
    if (!id) return;
    setApprovalLoading(true);
    try {
      const res = await api.get<ApprovalPayload>(`/approvals/documents/${id}/stages`);
      setApproval(res.data);
    } catch {
      setApproval(null);
    } finally {
      setApprovalLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!id) return;
    setEventsLoading(true);
    try {
      const res = await api.get<DocEvent[]>(`/files/${id}/events`);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const submitForRegistration = async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/files/${id}/submit-for-registration`);
      await load();
      await loadApproval();
      await loadEvents();
      notify("success", "Документ отправлен на проверку деканату.");
    } catch (err: any) {
      console.error("submit-for-registration error:", err?.response?.data ?? err?.response ?? err);
      const msg = err?.response?.data?.detail || "Ошибка отправки заявки";
      notify("error", typeof msg === "string" ? msg : "Ошибка отправки заявки");
    } finally {
      setSubmitting(false);
    }
  };

  const approveCurrentStage = async () => {
    if (!id) return;
    setApprovalAction("approve");
    try {
      await api.post(`/approvals/documents/${id}/approve`, { comment: null });
      await load();
      await loadApproval();
      await loadEvents();
      notify("success", "Этап согласования подтверждён.");
    } catch (err: any) {
      notify("error", err?.response?.data?.detail || "Ошибка подтверждения этапа");
    } finally {
      setApprovalAction(null);
    }
  };

  const rejectCurrentStage = async () => {
    if (!id) return;
    setApprovalAction("reject");
    try {
      await api.post(`/approvals/documents/${id}/reject`, { comment: null });
      await load();
      await loadApproval();
      await loadEvents();
      notify("success", "Этап согласования отклонён.");
    } catch (err: any) {
      notify("error", err?.response?.data?.detail || "Ошибка отклонения этапа");
    } finally {
      setApprovalAction(null);
    }
  };

  const finalRegisterOnChain = async () => {
    if (!id) return;
    setFinalRegistering(true);
    try {
      await api.post(`/admin/documents/${id}/approve`);
      await load();
      await loadApproval();
      await loadEvents();
      notify("success", "Документ зарегистрирован в блокчейне.");
    } catch (err: any) {
      notify("error", err?.response?.data?.detail || "Ошибка финальной регистрации");
    } finally {
      setFinalRegistering(false);
    }
  };

  const assignStudentWallet = async () => {
    if (!id || !studentWallet.trim()) return;
    setAssigningStudent(true);
    setError(null);
    try {
      await api.post(`/files/${id}/assign-owner`, { student_wallet_address: studentWallet.trim() });
      setStudentWallet("");
      notify("success", "Кошелёк выпускника привязан.");
      await load();
      await loadEvents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка привязки";
      notify("error", typeof msg === "string" ? msg : "Ошибка привязки");
    } finally {
      setAssigningStudent(false);
    }
  };

  const transferDocument = async () => {
    if (!id || !transferWallet.trim()) return;
    setTransferring(true);
    setError(null);
    try {
      await api.post(`/files/${id}/transfer`, { to_wallet_address: transferWallet.trim() });
      setTransferWallet("");
      notify("success", "Документ передан.");
      try {
        const res = await api.get<Data>(`/files/${id}`);
        setData(res.data);
        await loadEvents();
      } catch (reloadErr: any) {
        if (reloadErr?.response?.status === 403) {
          navigate("/files");
        } else {
          const msg = reloadErr?.response?.data?.detail || "Ошибка обновления данных";
          setError(typeof msg === "string" ? msg : "Ошибка обновления данных");
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка передачи";
      notify("error", typeof msg === "string" ? msg : "Ошибка передачи");
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    void load();
    void loadApproval();
    void loadEvents();
  }, [id]);

  // Polling + PATCH /status: обновление после согласования деканата (авто этапы 4–5).
  useEffect(() => {
    if (!id || !data) return;
    const studentWallet = (data.student_wallet_address || "").toLowerCase();
    const ownerWallet = (data.owner_wallet_address || "").toLowerCase();
    const pendingChain =
      (data.status === "DEAN_APPROVED" || data.status === "APPROVED") && !data.blockchain_tx_hash;
    const pendingAssign =
      Boolean(data.blockchain_tx_hash) &&
      data.status === "REGISTERED" &&
      Boolean(studentWallet) &&
      ownerWallet !== studentWallet;
    const waitingAutomation =
      data.status === "UNDER_REVIEW" || pendingChain || pendingAssign;
    if (!waitingAutomation) return;
    const iv = window.setInterval(() => {
      void (async () => {
        try {
          await api.patch(`/files/${id}/status`);
          const res = await api.get<Data>(`/files/${id}`);
          setData(res.data);
          const a = await api.get<ApprovalPayload>(`/approvals/documents/${id}/stages`);
          setApproval(a.data);
          await loadEvents();
        } catch {
          /* ignore */
        }
      })();
    }, 3000);
    return () => window.clearInterval(iv);
  }, [id, data?.status, data?.blockchain_tx_hash, data?.student_wallet_address, data?.owner_wallet_address]);

  if (error) {
    return (
      <div className="page file-detail-page">
        <div className="card">
          <PageHeader title="Детали документа" />
          <div className="bad">{error}</div>
          <button className="btn btn-muted" style={{ marginTop: 12 }} onClick={() => void load()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="text-center" style={{ marginTop: 60 }}>
        <Spinner size={48} />
      </div>
    );
  }

  const onChainRegistered = Boolean(data.blockchain_tx_hash);
  const canSubmit =
    canSubmitForRegistration(data.status, onChainRegistered) && user?.role === "department";
  const isOwner = user?.id === data.owner_id || user?.role === "admin";

  const docDisplayName = data.description?.trim() || data.title?.trim() || data.file_name;
  const currentStage = approval?.stages.find((s) => s.state === "CURRENT") ?? null;
  const canActOnStage = Boolean(currentStage?.can_act);
  const isDeanApprovedPendingChain =
    (data.status === "DEAN_APPROVED" || data.status === "APPROVED") && !data.blockchain_tx_hash;
  const studentWalletLower = (data.student_wallet_address || "").toLowerCase();
  const ownerWalletLower = (data.owner_wallet_address || "").toLowerCase();
  const isRegisteredPendingAssign =
    Boolean(data.blockchain_tx_hash) &&
    data.status === "REGISTERED" &&
    Boolean(studentWalletLower) &&
    ownerWalletLower !== studentWalletLower;
  const automationInProgress = isDeanApprovedPendingChain || isRegisteredPendingAssign;
  const readyForFinal =
    (data.status === "DEAN_APPROVED" || data.status === "APPROVED") &&
    !onChainRegistered &&
    (approval?.ready_for_final_registration ?? true);
  const isAdmin = user?.role === "admin";
  const canAssignStudent =
    (data.status === "REGISTERED_ON_CHAIN" || data.status === "REGISTERED") &&
    (!studentWalletLower || ownerWalletLower !== studentWalletLower) &&
    (isOwner || isAdmin);
  const canActDean = canActOnStage && user?.role === "dean";
  const underReview = data.status === "UNDER_REVIEW" || data.status === "PENDING_APPROVAL";
  const departmentWaitingForDean =
    user?.role === "department" && underReview && !canSubmitForRegistration(data.status, onChainRegistered);
  const canOpenDocumentReview =
    underReview && (user?.role === "dean" || user?.role === "registrar");

  const stageStateLabel = (state: string) => {
    switch (state) {
      case "CURRENT":
        return "Текущий";
      case "APPROVED":
        return "Согласовано";
      case "REJECTED":
        return "Отклонено";
      case "PENDING":
        return "Ожидает";
      default:
        return state;
    }
  };

  return (
    <div className="page file-detail-page">
      <PageHeader
        title="Документ"
        subtitle={docDisplayName}
        backTo={{ to: "/files", label: "Мои документы" }}
        actions={
          <Link to={`/certificate/${data.id}`} className="btn btn-outline btn-sm">
            Сертификат
          </Link>
        }
      />

      {!data.description?.trim() && (
        <p className="file-row-desc-hint" style={{ marginTop: 4 }}>
          Добавьте название документа в метаданных при следующей загрузке (сейчас отображается имя файла).
        </p>
      )}

      <div
        className={`card card--premium file-detail-hero${automationInProgress ? " file-detail-hero--automation" : ""}`}
      >
        <div className="file-detail-hero-top">
          <div className="file-detail-hero-main">
            <div
              className="muted"
              style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}
            >
              Документ
            </div>
            <h1 className="file-detail-hero-title" title={docDisplayName}>
              {docDisplayName}
            </h1>
            {(data.status === "UNDER_REVIEW" || data.status === "PENDING_APPROVAL") && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                {currentStage ? `Этап: ${currentStage.title}` : "На согласовании у деканата"}
              </p>
            )}
          </div>
          <div className="file-detail-hero-status">
            <span className="muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Статус
            </span>
            <DocumentStatusBadge status={data.status} onChain={onChainRegistered} />
          </div>
          <div className="file-detail-hero-actions">
            {!onChainRegistered && canSubmit && (
              <button
                type="button"
                className="btn-approval btn-approval--primary"
                onClick={() => void submitForRegistration()}
                disabled={submitting}
              >
                {submitting ? "Отправка…" : "Отправить на проверку деканату"}
              </button>
            )}
            {departmentWaitingForDean && (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  borderRadius: 8,
                  maxWidth: 440,
                }}
              >
                Документ отправлен на согласование. Ожидайте решения деканата.
              </div>
            )}
            {canOpenDocumentReview && (
              <button
                type="button"
                className="btn-approval btn-approval--muted"
                onClick={() => void handleOpenDocumentInNewTab()}
                disabled={openingDoc}
              >
                {openingDoc ? "…" : "Открыть документ"}
              </button>
            )}
            {canActDean && (
              <div className="file-detail-hero-actions-row">
                <button
                  type="button"
                  className="btn-approval btn-approval--primary"
                  onClick={() => void approveCurrentStage()}
                  disabled={approvalAction !== null}
                >
                  {approvalAction === "approve" ? "…" : "Подтвердить диплом"}
                </button>
                <button
                  type="button"
                  className="btn-approval btn-approval--danger"
                  onClick={() => void rejectCurrentStage()}
                  disabled={approvalAction !== null}
                >
                  {approvalAction === "reject" ? "…" : "Отклонить"}
                </button>
              </div>
            )}
            {automationInProgress && (
              <p className="file-detail-hero-actions-hint muted">
                {isDeanApprovedPendingChain
                  ? "Регистрация в блокчейне выполняется автоматически…"
                  : "Закрепление за кошельком выпускника выполняется автоматически…"}
              </p>
            )}
            {readyForFinal && isAdmin && (
              <button
                type="button"
                className="btn-approval btn-approval--muted"
                onClick={() => void finalRegisterOnChain()}
                disabled={finalRegistering}
                title="Резерв, если автоматика не сработала"
              >
                {finalRegistering ? "Регистрация…" : "Ручная регистрация (резерв)"}
              </button>
            )}
          </div>
        </div>

        <div className="file-detail-meta-grid">
          <div className="file-detail-meta-item">
            <div className="label">Владелец</div>
            <div style={{ fontWeight: 600 }}>{data.owner_email || "Владелец по кошельку"}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {data.owner_wallet_address || data.student_wallet_address || "—"}
            </div>
          </div>
          <div className="file-detail-meta-item">
            <div className="label">Загрузил</div>
            <div style={{ fontWeight: 600 }}>{data.uploaded_by_email || data.uploaded_by_id || "—"}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {data.uploaded_by_wallet_address || "—"}
            </div>
          </div>
          <div className="file-detail-meta-item">
            <div className="label">Файл</div>
            <div style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              <strong>{data.file_name}</strong>
              {isOwner && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                >
                  {downloading ? "…" : "Скачать"}
                </button>
              )}
            </div>
          </div>
          <div className="file-detail-meta-item">
            <div className="label">SHA-256 (фрагмент)</div>
            <code title={data.sha256_hash}>{hashShort(data.sha256_hash)}</code>
          </div>
          <div className="file-detail-meta-item">
            <div className="label">Создан</div>
            {new Date(data.created_at).toLocaleString()}
          </div>
          {data.owner_wallet_address && (
            <div className="file-detail-meta-item">
              <div className="label">Кошелёк владельца</div>
              <code style={{ fontSize: 11 }}>{data.owner_wallet_address}</code>
            </div>
          )}
          {data.student_wallet_address && (
            <div className="file-detail-meta-item">
              <div className="label">Кошелёк выпускника</div>
              <code style={{ fontSize: 11 }} title={data.student_wallet_address}>
                {data.student_wallet_address}
              </code>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <StageTimeline
          status={data.status}
          processingStage={data.processing_stage}
          createdAt={data.created_at}
          sha256Hash={data.sha256_hash}
          departmentApprovedAt={data.department_approved_at}
          deaneryApprovedAt={data.deanery_approved_at}
          aiCheckStatus={data.ai_check_status}
          blockchainTxHash={data.blockchain_tx_hash}
          studentWalletAddress={data.student_wallet_address}
          highlightAutomation={automationInProgress}
        />
      </div>

      <div className="file-detail-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="ui-card-head">
              <div>
                <h2 className="ui-card-title">Доказательство в блокчейне</h2>
                <p className="ui-card-desc">Транзакция и идентификатор объекта в смарт-контракте.</p>
              </div>
            </div>
            <BlockchainInfoCard
              txHash={data.blockchain_tx_hash}
              objectId={data.blockchain_object_id}
              txExplorerUrl={data.tx_explorer_url}
            />
            {data.blockchain_registered_at && (
              <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                Зарегистрировано: {new Date(data.blockchain_registered_at).toLocaleString()}
              </p>
            )}
          </div>

          {canAssignStudent && (
            <div className="card">
              <div className="ui-card-head">
                <div>
                  <h2 className="ui-card-title">Привязка к выпускнику</h2>
                  <p className="ui-card-desc">Этап 5: укажите Ethereum-кошелёк студента для отображения в верификации.</p>
                </div>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="label">Адрес кошелька выпускника</div>
                  <input
                    className="input"
                    placeholder="0x…"
                    value={studentWallet}
                    onChange={(e) => setStudentWallet(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void assignStudentWallet()}
                  disabled={assigningStudent || !studentWallet.trim()}
                >
                  {assigningStudent ? "…" : "Привязать кошелёк"}
                </button>
              </div>
            </div>
          )}

          <div className="card card--premium">
            <div className="ui-card-head">
              <div>
                <h2 className="ui-card-title">Подлинность и публичная ссылка</h2>
                <p className="ui-card-desc">
                  Хэш и файл после загрузки неизменяемы. Проверка подлинности — по содержимому (SHA-256) на странице
                  верификации.
                </p>
              </div>
            </div>
            {publicVerifyUrl ? (
              <div className="row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="qr-box">
                  <QRCode value={publicVerifyUrl} size={152} level="M" fgColor="#eaecef" bgColor="#0b0e11" />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="label">Verify link</div>
                  <div className="verify-link-box">{publicVerifyUrl}</div>
                  <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(publicVerifyUrl);
                        notify("success", "Ссылка скопирована");
                      }}
                    >
                      Копировать
                    </button>
                    <Link to="/verify" className="btn btn-primary btn-sm">
                      Проверить документ
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <div className="ui-card-head">
              <div>
                <h2 className="ui-card-title">Согласование</h2>
                <p className="ui-card-desc">
                  Один этап — подтверждение деканатом; далее регистрация в сети и закрепление за выпускником выполняются
                  автоматически.
                </p>
              </div>
            </div>
            {approvalLoading ? (
              <div className="text-center" style={{ padding: 16 }}>
                <Spinner size={24} />
              </div>
            ) : !approval || approval.stages.length === 0 ? (
              <div className="muted">Этапы ещё не запускались (документ не отправлен на согласование).</div>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  {automationInProgress
                    ? isDeanApprovedPendingChain
                      ? "Деканат подтвердил документ. Выполняются автоматические этапы регистрации в блокчейне и закрепления за выпускником."
                      : "Выполняется автоматическое закрепление диплома за кошельком выпускника."
                    : `Текущий этап: ${currentStage ? currentStage.title : approval.all_stages_completed ? "завершены" : "—"}`}
                </p>
                <div className="ui-table-wrap table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Этап</th>
                        <th>Статус</th>
                        <th>Когда</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approval.stages.map((stage) => (
                        <tr key={stage.stage_id}>
                          <td>{stage.title}</td>
                          <td>{stageStateLabel(stage.state)}</td>
                          <td>{stage.acted_at ? new Date(stage.acted_at).toLocaleString() : "—"}</td>
                          <td>{stage.comment || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="ui-card-head">
              <div>
                <h2 className="ui-card-title">Журнал событий</h2>
                <p className="ui-card-desc">Аудит действий по документу (последние записи).</p>
              </div>
            </div>
            {eventsLoading ? (
              <div className="text-center" style={{ padding: 16 }}>
                <Spinner size={22} />
              </div>
            ) : events.length === 0 ? (
              <div className="muted">Событий пока нет.</div>
            ) : (
              <div className="ui-table-wrap table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Событие</th>
                      <th>Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(ev.timestamp).toLocaleString()}</td>
                        <td>{formatEventAction(ev.action)}</td>
                        <td>
                          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                            {eventSummary(ev.metadata)}
                          </div>
                          {ev.metadata ? (
                            <details>
                              <summary className="muted" style={{ cursor: "pointer", fontSize: 12 }}>
                                JSON
                              </summary>
                              <pre
                                style={{
                                  marginTop: 6,
                                  padding: 8,
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  maxWidth: 460,
                                  maxHeight: 180,
                                  overflow: "auto",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: 11,
                                }}
                              >
                                {JSON.stringify(ev.metadata, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <code style={{ fontSize: 11 }}>—</code>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isOwner && data.blockchain_tx_hash && (
            <div className="card">
              <div className="ui-card-head">
                <div>
                  <h2 className="ui-card-title">Передача прав</h2>
                  <p className="ui-card-desc">Только после on-chain регистрации. Новый владелец должен быть в системе.</p>
                </div>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="label">Кошелёк получателя</div>
                  <input
                    className="input"
                    placeholder="0x…"
                    value={transferWallet}
                    onChange={(e) => setTransferWallet(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => void transferDocument()}
                  disabled={transferring || !transferWallet.trim()}
                >
                  {transferring ? "…" : "Передать"}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="file-detail-aside">
          <div className="card card--subtle">
            <div className="ui-section-label">Кратко</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>
                <span className="muted">ID:</span> <code style={{ fontSize: 11 }}>{data.id}</code>
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="muted">Владелец:</span> {data.owner_email || data.owner_id}
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="muted">On-chain:</span> {onChainRegistered ? "да" : "нет"}
              </div>
            </div>
          </div>
          {data.storage_key && (
            <div className="card card--subtle">
              <div className="ui-section-label">Хранилище</div>
              <code style={{ fontSize: 10, wordBreak: "break-all" }}>{data.storage_key}</code>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
