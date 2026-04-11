import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { FileTable, FileRow } from "../components/FileTable";
import { Spinner } from "../components/ui/Spinner";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";

export const MyFilesPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { notify } = useNotification();
  const [filtered, setFiltered] = useState<FileRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState<string | null>(null);

  const load = async (q: string = "", status: string = "") => {
    setError(null);
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (status && status !== "ALL") params.status = status;
      const res = await api.get<FileRow[]>("/files", { params });
      setFiltered(res.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      setError(ax?.response?.data?.detail || "Ошибка загрузки списка");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitForRegistration = async (id: string) => {
    setLoadingRegister(id);
    try {
      await api.post(`/files/${id}/submit-for-registration`);
      await load(search, statusFilter);
      notify("success", "Документ отправлен на рассмотрение.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown } };
      console.error("submit-for-registration error:", ax?.response?.data ?? ax?.response ?? err);
      const msg = (ax?.response?.data as { detail?: string })?.detail || "Ошибка отправки заявки";
      setError(typeof msg === "string" ? msg : "Ошибка отправки заявки");
      notify("error", typeof msg === "string" ? msg : "Ошибка отправки заявки");
    } finally {
      setLoadingRegister(null);
    }
  };

  useEffect(() => {
    void load(search, statusFilter);
  }, [search, statusFilter, location.key]);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Мои документы
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Список загрузок, фильтр по статусу, переход к карточке.
          </p>
        </div>
        {user?.role === "department" && (
          <Link to="/upload" className="ui-btn ui-btn--primary ui-btn--md" style={{ textDecoration: "none" }}>
            Загрузить диплом
          </Link>
        )}
      </div>

      <Card>
        {error && <div className="bad" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="page-toolbar">
          <div style={{ flex: "1 1 220px", minWidth: 0, maxWidth: 360 }}>
            <div className="label">Поиск</div>
            <input
              className="input"
              placeholder="Имя файла…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: "0 1 220px", minWidth: 0 }}>
            <div className="label">Статус</div>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Все статусы</option>
              <option value="FROZEN">Черновик</option>
              <option value="UNDER_REVIEW">На проверке</option>
              <option value="APPROVED">Готов к регистрации</option>
              <option value="REGISTERED_ON_CHAIN">В блокчейне</option>
              <option value="REJECTED">Отклонён</option>
              <option value="TRANSFERRED">Передан</option>
            </select>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        {user?.role === "department" && (
          <div
            className="ok"
            style={{
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.55,
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            <strong>Алгоритм:</strong> загрузите документ → нажмите «Отправить на проверку деканату» — дальше решение
            принимает деканат.
          </div>
        )}
        {loading ? (
          <div className="text-center" style={{ padding: 32 }}>
            <Spinner size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden>
              📁
            </div>
            <div style={{ fontWeight: 600 }}>Документов пока нет</div>
            <p className="muted" style={{ marginTop: 8 }}>
              Загрузите документ — он появится здесь.
            </p>
            {user?.role === "department" && (
              <Link to="/upload" className="ui-btn ui-btn--primary ui-btn--md" style={{ marginTop: 16, textDecoration: "none" }}>
                Загрузить диплом
              </Link>
            )}
          </div>
        ) : (
          <div className="data-table-wrap">
            <FileTable
              items={filtered}
              onSubmitForRegistration={user?.role === "department" ? onSubmitForRegistration : undefined}
              loadingId={loadingRegister}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
