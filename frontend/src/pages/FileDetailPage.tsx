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
  title?: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  description?: string | null;
  blockchain_object_id?: string | null;
  blockchain_tx_hash?: string | null;
  blockchain_registered_at?: string | null;
  owner_id: string;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
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
      notify("success", "Документ отправлен на рассмотрение и отображается в общем реестре.");
    } catch (err: any) {
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
  const canSubmit = canSubmitForRegistration(data.status, onChainRegistered);
  const isOwner = user?.id === data.owner_id || user?.role === "admin";

  const docDisplayName = data.description?.trim() || data.title?.trim() || data.file_name;
  const currentStage = approval?.stages.find((s) => s.state === "CURRENT") ?? null;
  const canActOnStage = Boolean(currentStage?.can_act);
  const readyForFinal =
    data.status === "APPROVED" && !onChainRegistered && (approval?.ready_for_final_registration ?? true);
  const isAdmin = user?.role === "admin";
  const canAssignStudent =
    data.status === "REGISTERED_ON_CHAIN" &&
    !data.student_wallet_address &&
    (isOwner || isAdmin);

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
          <div className="file-detail-toolbar">
            {!onChainRegistered && canSubmit && (
              <button type="button" className="btn-review" onClick={() => void submitForRegistration()} disabled={submitting}>
                {submitting ? "Отправка…" : "Отправить на согласование"}
              </button>
            )}
            {(data.status === "UNDER_REVIEW" || data.status === "PENDING_APPROVAL") && (
              <span className="muted" style={{ fontSize: 13 }}>
                {currentStage ? `Этап: ${currentStage.title}` : "На согласовании"}
              </span>
            )}
            {readyForFinal && isAdmin && (
              <span className="muted" style={{ fontSize: 13 }}>
                Готов к финальной регистрации
              </span>
            )}
            {readyForFinal && !isAdmin && (
              <span className="muted" style={{ fontSize: 13 }}>
                Ожидайте финальной регистрации администратором
              </span>
            )}
            {readyForFinal && isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void finalRegisterOnChain()}
                disabled={finalRegistering}
              >
                {finalRegistering ? "Регистрация…" : "Финальная регистрация"}
              </button>
            )}
            {canActOnStage && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => void approveCurrentStage()}
                  disabled={approvalAction !== null}
                >
                  {approvalAction === "approve" ? "…" : "Подтвердить этап"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => void rejectCurrentStage()}
                  disabled={approvalAction !== null}
                >
                  {approvalAction === "reject" ? "…" : "Отклонить этап"}
                </button>
              </>
            )}
            <Link to={`/certificate/${data.id}`} className="btn btn-outline btn-sm">
              Сертификат
            </Link>
          </div>
        }
      />

      {!data.description?.trim() && (
        <p className="file-row-desc-hint" style={{ marginTop: 4 }}>
          Добавьте название документа в метаданных при следующей загрузке (сейчас отображается имя файла).
        </p>
      )}

      <div className="card card--premium file-detail-hero">
        <div className="file-detail-hero-top">
          <div>
            <div
              className="muted"
              style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}
            >
              Документ
            </div>
            <h1 className="file-detail-hero-title">{docDisplayName}</h1>
          </div>
          <div>
            <span className="muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Статус
            </span>
            <DocumentStatusBadge status={data.status} onChain={onChainRegistered} />
          </div>
        </div>

        <div className="file-detail-meta-grid">
          <div className="file-detail-meta-item">
            <div className="label">Владелец</div>
            <div style={{ fontWeight: 600 }}>{data.owner_email || data.owner_id}</div>
          </div>
          <div className="file-detail-meta-item">
            <div className="label">Файл</div>
            <div>
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
              <div className="label">Кошелёк</div>
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
            <BlockchainInfoCard txHash={data.blockchain_tx_hash} objectId={data.blockchain_object_id} />
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
                <p className="ui-card-desc">Внутренние этапы до статуса APPROVED и финальной регистрации.</p>
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
                  {data.status === "APPROVED" && !onChainRegistered
                    ? "Все этапы пройдены. Документ готов к официальной регистрации администратором."
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
                          <code style={{ fontSize: 11 }}>
                            {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 120) : "—"}
                            {ev.metadata && JSON.stringify(ev.metadata).length > 120 ? "…" : ""}
                          </code>
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
