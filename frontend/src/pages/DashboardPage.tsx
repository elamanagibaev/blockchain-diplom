import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { MetricCard } from "../components/MetricCard";
import { Spinner } from "../components/ui/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { api } from "../api/client";
import { Card } from "../components/ui/Card";

type Metrics = {
  total: number;
  on_chain: number;
  verified: number;
  invalid: number;
};

type PendingRow = { id: string; file_name: string };

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<FileRow[]>([]);
  const [pendingReview, setPendingReview] = useState(0);
  const [readyFinalMine, setReadyFinalMine] = useState(0);
  const [adminFinalQueue, setAdminFinalQueue] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const metricsRes = await api.get<Metrics>("/files/metrics");
      setMetrics(metricsRes.data);

      const filesRes = await api.get<FileRow[]>("/files");
      const files = Array.isArray(filesRes.data) ? filesRes.data : [];
      const sorted = [...files].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecent(sorted.slice(0, 8));

      setPendingReview(
        files.filter((f) => f.status === "UNDER_REVIEW" || f.status === "PENDING_APPROVAL").length
      );
      setReadyFinalMine(files.filter((f) => f.status === "APPROVED" && !f.blockchain_tx_hash).length);

      if (user?.role === "admin") {
        try {
          const pend = await api.get<PendingRow[]>("/admin/documents/pending");
          setAdminFinalQueue(Array.isArray(pend.data) ? pend.data.length : 0);
        } catch {
          setAdminFinalQueue(0);
        }
      } else {
        setAdminFinalQueue(0);
      }
    } catch {
      setMetrics(null);
      setRecent([]);
      notify("error", "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id, user?.role]);

  const pendingOffChain =
    metrics && typeof metrics.total === "number" && typeof metrics.on_chain === "number"
      ? Math.max(metrics.total - metrics.on_chain, 0)
      : 0;

  const displayName = user?.email?.split("@")[0] || "пользователь";

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Панель · {displayName}
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Сводка по документам и блокчейну.
          </p>
        </div>
        {user?.role === "department" && (
          <Link to="/upload" className="ui-btn ui-btn--primary ui-btn--md" style={{ textDecoration: "none" }}>
            Загрузить диплом
          </Link>
        )}
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Верификация дипломов на блокчейне</h2>
        <p className="muted" style={{ marginBottom: 16, maxWidth: 560 }}>
          Кафедра загружает документ и подаёт на согласование; деканат подтверждает; администратор выполняет запись в сеть.
          Проверка подлинности доступна любому пользователю.
        </p>
        <div className="dashboard-hero-actions">
          {user?.role === "department" && (
            <Link to="/upload" className="ui-btn ui-btn--primary ui-btn--md" style={{ textDecoration: "none" }}>
              Загрузить документ
            </Link>
          )}
          <Link to="/verify" className="ui-btn ui-btn--secondary ui-btn--md" style={{ textDecoration: "none" }}>
            Проверить документ
          </Link>
        </div>
      </Card>

      <div className="dashboard-stats-grid">
        <MetricCard title="Всего документов" value={loading ? "—" : metrics?.total ?? 0} icon={<FileText size={18} />} />
        <MetricCard
          title="В блокчейне"
          value={loading ? "—" : metrics?.on_chain ?? 0}
          color="var(--success)"
          icon={<ShieldCheck size={18} />}
        />
        <MetricCard
          title="На согласовании"
          value={loading ? "—" : pendingReview}
          color="var(--warning)"
        />
        <MetricCard title="Без on-chain" value={loading ? "—" : pendingOffChain} color="var(--text-muted)" />
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Готовы к финальной регистрации</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? "—" : readyFinalMine}</div>
        </Card>
        {user?.role === "admin" && (
          <Card style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Очередь админа</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? "—" : adminFinalQueue}</div>
          </Card>
        )}
      </div>

      <div className="dashboard-two-col">
        <Card>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Недавние документы</h2>
            <Link to="/files" className="muted" style={{ fontSize: 14 }}>
              Все документы →
            </Link>
          </div>
          {loading ? (
            <div className="text-center" style={{ padding: 24 }}>
              <Spinner size={28} />
            </div>
          ) : recent.length ? (
            <div className="data-table-wrap">
              <FileTable items={recent} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden>
                📄
              </div>
              <div style={{ fontWeight: 600 }}>Документов пока нет</div>
              {user?.role === "department" && (
                <Link to="/upload" style={{ display: "inline-block", marginTop: 12 }}>
                  Загрузить диплом
                </Link>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Как это работает</h3>
          <ol style={{ paddingLeft: 18, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
            <li style={{ marginBottom: 8 }}>Загрузка и фиксация хэша</li>
            <li style={{ marginBottom: 8 }}>Проверка ИИ (опционально)</li>
            <li style={{ marginBottom: 8 }}>Согласование деканатом</li>
            <li style={{ marginBottom: 8 }}>Регистрация в реестре</li>
            <li>Закрепление за владельцем и QR</li>
          </ol>
          {user?.role === "admin" && (
            <Link to="/admin" className="ui-btn ui-btn--primary ui-btn--md" style={{ display: "block", textAlign: "center", marginTop: 12, textDecoration: "none" }}>
              Админ-панель
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
};
