import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";

type DeanPendingDocument = {
  id: string;
  file_name: string;
  title: string | null;
  owner_email: string | null;
  owner_full_name: string | null;
  uploaded_by_email: string | null;
  created_at: string;
  status: string;
  document_type: string | null;
};

export const DeanQueuePage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [rows, setRows] = useState<DeanPendingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectSubmitAttempted, setRejectSubmitAttempted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DeanPendingDocument[]>("/approvals/pending-for-dean");
      setRows(res.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail;
      notify("error", typeof msg === "string" ? msg : "Не удалось загрузить список");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (user?.role !== "dean") {
      setLoading(false);
      setRows([]);
      return;
    }
    void load();
  }, [user?.role, load]);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/approvals/documents/${id}/approve`, { comment: "" });
      notify("success", "Документ одобрен");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail;
      notify("error", typeof msg === "string" ? msg : "Ошибка одобрения");
    } finally {
      setActionId(null);
    }
  };

  const reject = async (id: string) => {
    const trimmed = rejectComment.trim();
    if (!trimmed) {
      setRejectSubmitAttempted(true);
      return;
    }
    setActionId(id);
    try {
      await api.post(`/approvals/documents/${id}/reject`, { comment: trimmed });
      notify("success", "Документ отклонён");
      setRejectingId(null);
      setRejectComment("");
      setRejectSubmitAttempted(false);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail;
      notify("error", typeof msg === "string" ? msg : "Ошибка отклонения");
    } finally {
      setActionId(null);
    }
  };

  const docTitle = (r: DeanPendingDocument) => (r.title && r.title.trim()) || r.file_name;

  if (user?.role !== "dean") {
    return (
      <div className="page">
        <PageHeader title="Документы на согласование" />
        <div className="card" style={{ marginTop: 16 }}>
          <div className="bad">Эта страница доступна только пользователям с ролью «Деканат».</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Документы на согласование"
        subtitle="Документы от кафедр вашего университета, ожидающие вашего решения"
      />

      <div className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>
            <Spinner size={36} />
          </div>
        ) : rows.length === 0 ? (
          <div className="muted" style={{ padding: 16 }}>
            Нет документов, ожидающих согласования
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Студент (email)</th>
                  <th>Кафедра (uploaded_by_email)</th>
                  <th>Тип</th>
                  <th>Дата загрузки</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const trimmedComment = rejectComment.trim();
                  const canConfirmReject = trimmedComment.length > 0;
                  const showRejectError = rejectingId === r.id && rejectSubmitAttempted && !canConfirmReject;
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td>{docTitle(r)}</td>
                        <td>{r.owner_email || "—"}</td>
                        <td>{r.uploaded_by_email || "—"}</td>
                        <td>{r.document_type || "—"}</td>
                        <td>{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                        <td>
                          {rejectingId !== r.id ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={actionId === r.id}
                                onClick={() => void approve(r.id)}
                              >
                                {actionId === r.id ? "…" : "Одобрить"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                disabled={actionId === r.id}
                                onClick={() => {
                                  setRejectingId(r.id);
                                  setRejectComment("");
                                  setRejectSubmitAttempted(false);
                                }}
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                      {rejectingId === r.id && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--color-surface-elevated, rgba(0,0,0,0.02))" }}>
                            <div style={{ padding: "12px 0 16px", maxWidth: 480 }}>
                              <textarea
                                className="input"
                                rows={2}
                                placeholder="Укажите причину отклонения (обязательно)..."
                                value={rejectComment}
                                onChange={(e) => {
                                  setRejectComment(e.target.value);
                                  if (rejectSubmitAttempted && e.target.value.trim()) {
                                    setRejectSubmitAttempted(false);
                                  }
                                }}
                                style={{ width: "100%", resize: "vertical", minHeight: 56 }}
                              />
                              {showRejectError && (
                                <div className="bad" style={{ marginTop: 6, fontSize: 13 }}>
                                  Причина обязательна
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${canConfirmReject ? "btn-danger" : "btn-muted"}`}
                                  disabled={actionId === r.id || !canConfirmReject}
                                  style={
                                    !canConfirmReject
                                      ? { opacity: 0.65, cursor: "not-allowed" }
                                      : undefined
                                  }
                                  onClick={() => void reject(r.id)}
                                >
                                  {actionId === r.id ? "…" : "Подтвердить отклонение"}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-muted"
                                  disabled={actionId === r.id}
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectComment("");
                                    setRejectSubmitAttempted(false);
                                  }}
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
