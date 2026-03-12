import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { MetricCard } from "../components/MetricCard";
import { Spinner } from "../components/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { ActivityList } from "../components/ActivityList";
import { api } from "../api/client";

type Metrics = {
  total: number;
  on_chain: number;
  verified: number;
  invalid: number;
};

type ActivityItem = {
  id: string;
  action_type: string;
  performed_at: string;
  file_name: string;
  object_id: string;
  details?: string | null;
};

type BlockchainEvent = {
  id: string;
  action_type: string;
  document_file_name: string | null;
  timestamp: string;
  tx_hash: string;
  from_wallet: string | null;
  to_wallet: string | null;
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<FileRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [blockchainEvents, setBlockchainEvents] = useState<BlockchainEvent[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [metricsRes, filesRes, activityRes, eventsRes] = await Promise.all([
        api.get<Metrics>("/files/metrics"),
        api.get<FileRow[]>("/files"),
        api.get<{ actions: ActivityItem[] }>("/files/activity/recent?limit=8"),
        api.get<BlockchainEvent[]>("/blockchain/events").then((r) => r.data.slice(0, 5)).catch(() => []),
      ]);
      setMetrics(metricsRes.data);
      const sorted = [...filesRes.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecent(sorted.slice(0, 5));
      setActivity(activityRes.data.actions || []);
      setPendingCount(
        Array.isArray(filesRes.data) ? filesRes.data.filter((f: FileRow) => f.status === "PENDING_APPROVAL").length : 0
      );
      setBlockchainEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch {
      setMetrics(null);
      setRecent([]);
      setActivity([]);
      setBlockchainEvents([]);
      notify("error", "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingOnChain =
    metrics && typeof metrics.total === "number" && typeof metrics.on_chain === "number"
      ? Math.max(metrics.total - metrics.on_chain, 0)
      : 0;

  return (
    <div className="page dashboard-page">
      {/* Hero */}
      <div className="dashboard-hero">
        <div className="card dashboard-hero-main">
          <div className="dashboard-hero-main-inner">
            <div className="badge badge-accent badge-pill">Blockchain-платформа</div>
            <h1 className="dashboard-hero-title">
              Добро пожаловать, {user?.email?.split("@")[0] || "пользователь"}
            </h1>
            <p className="dashboard-hero-desc">
              Защищённая платформа для регистрации и хранения документов. Хэши фиксируются в блокчейне.
            </p>
            <div className="dashboard-hero-actions">
              <Link to="/upload" className="btn btn-primary">
                Загрузить документ
              </Link>
              <Link to="/verify" className="btn btn-outline">
                Проверить подлинность
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="dashboard-stats-grid">
        <MetricCard title="Всего документов" value={loading ? "—" : (metrics?.total ?? 0)} />
        <MetricCard title="On-chain" value={loading ? "—" : (metrics?.on_chain ?? 0)} color="var(--color-success)" />
        <MetricCard title="На рассмотрении" value={loading ? "—" : pendingCount} color="var(--color-warning)" />
        <MetricCard title="Ожидают регистрации" value={loading ? "—" : pendingOnChain} color="var(--color-muted)" />
      </div>

      {/* Wallet */}
      {user?.wallet_address && (
        <div className="card dashboard-wallet-card">
          <div className="dashboard-wallet-inner">
            <div>
              <div className="label">Ваш Wallet</div>
              <code className="wallet-address">{user.wallet_address}</code>
            </div>
            <Link to="/profile" className="btn btn-outline btn-sm">
              Профиль
            </Link>
          </div>
        </div>
      )}

      {/* Main content: Recent docs + Activity + Blockchain events */}
      <div className="dashboard-main-grid">
        <div className="card dashboard-section">
          <div className="section-header">
            <h3 className="section-title">Последние документы</h3>
            <Link to="/files" className="btn btn-outline btn-sm">
              Все документы
            </Link>
          </div>
          {loading ? (
            <div className="section-loading">
              <Spinner size={24} />
            </div>
          ) : recent.length ? (
            <div className="table-scroll">
              <FileTable items={recent} />
            </div>
          ) : (
            <div className="section-empty muted">Пока нет документов</div>
          )}
        </div>

        <div className="card dashboard-section">
          <div className="section-header">
            <h3 className="section-title">Последние действия</h3>
            <Link to="/audit" className="btn btn-outline btn-sm">
              Журнал
            </Link>
          </div>
          {loading ? (
            <div className="section-loading">
              <Spinner size={24} />
            </div>
          ) : (
            <ActivityList items={activity} emptyMessage="Нет действий" />
          )}
        </div>
      </div>

      {/* Blockchain events */}
      {blockchainEvents.length > 0 && (
        <div className="card dashboard-section">
          <div className="section-header">
            <h3 className="section-title">События блокчейна</h3>
            <Link to="/blockchain-journal" className="btn btn-outline btn-sm">
              Журнал блокчейна
            </Link>
          </div>
          <div className="activity-list">
            {blockchainEvents.map((e) => (
              <div key={e.id} className="activity-list-item">
                <span className="activity-list-icon">
                  {e.action_type === "REGISTER" ? "📝" : "↔"}
                </span>
                <div className="activity-list-content">
                  <span className="activity-list-type">
                    {e.action_type === "REGISTER" ? "Регистрация" : "Передача"}: {e.document_file_name || "—"}
                  </span>
                  <span className="activity-list-time">
                    {new Date(e.timestamp).toLocaleString("ru-RU")}
                    {e.tx_hash && ` · ${e.tx_hash.slice(0, 10)}…`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions / Services */}
      <div className="card dashboard-section">
        <h3 className="section-title" style={{ marginBottom: 16 }}>Быстрые действия</h3>
        <div className="services-grid">
          <Link to="/upload" className="service-card">
            <div className="service-card-icon">↑</div>
            <h4 className="service-card-title">Загрузка</h4>
            <p className="service-card-desc">Регистрация документа</p>
          </Link>
          <Link to="/verify" className="service-card">
            <div className="service-card-icon">✓</div>
            <h4 className="service-card-title">Верификация</h4>
            <p className="service-card-desc">Проверка подлинности</p>
          </Link>
          <Link to="/files" className="service-card">
            <div className="service-card-icon">📁</div>
            <h4 className="service-card-title">Мои патенты</h4>
            <p className="service-card-desc">Управление документами</p>
          </Link>
          <Link to="/global" className="service-card">
            <div className="service-card-icon">🌐</div>
            <h4 className="service-card-title">Общая база</h4>
            <p className="service-card-desc">Глобальный реестр</p>
          </Link>
        </div>
      </div>
    </div>
  );
};
