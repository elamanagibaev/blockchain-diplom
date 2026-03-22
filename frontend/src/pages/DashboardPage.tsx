import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { MetricCard } from "../components/MetricCard";
import { Spinner } from "../components/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { api } from "../api/client";

type Metrics = {
  total: number;
  on_chain: number;
  verified: number;
  invalid: number;
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<FileRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [metricsRes, filesRes] = await Promise.all([
        api.get<Metrics>("/files/metrics"),
        api.get<FileRow[]>("/files"),
      ]);
      setMetrics(metricsRes.data);
      const sorted = [...filesRes.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecent(sorted.slice(0, 8));
      setPendingCount(
        Array.isArray(filesRes.data) ? filesRes.data.filter((f: FileRow) => f.status === "PENDING_APPROVAL").length : 0
      );
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
  }, []);

  const pendingOnChain =
    metrics && typeof metrics.total === "number" && typeof metrics.on_chain === "number"
      ? Math.max(metrics.total - metrics.on_chain, 0)
      : 0;

  const displayName = user?.email?.split("@")[0] || "пользователь";

  return (
    <div className="page dashboard-page">
      <div className="dashboard-hero">
        <div className="card dashboard-hero-main">
          <div className="dashboard-hero-main-inner">
            <div className="badge badge-accent badge-pill">Блокчейн-реестр</div>
            <h1 className="dashboard-hero-title">Добро пожаловать, {displayName}</h1>
            <p className="dashboard-hero-desc">
              Регистрация и хранение патентных документов: хэш фиксируется в блокчейне, файл остаётся в защищённом
              хранилище.
            </p>
            <div className="dashboard-hero-actions">
              <Link to="/upload" className="btn btn-primary">
                Загрузить документ
              </Link>
              <Link to="/verify" className="btn btn-outline">
                Верифицировать по хэшу
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <MetricCard title="Всего документов" value={loading ? "—" : (metrics?.total ?? 0)} />
        <MetricCard title="В блокчейне" value={loading ? "—" : (metrics?.on_chain ?? 0)} color="var(--color-success)" />
        <MetricCard title="На рассмотрении" value={loading ? "—" : pendingCount} color="var(--color-warning)" />
        <MetricCard
          title="Без on-chain записи"
          value={loading ? "—" : pendingOnChain}
          color="var(--color-muted)"
        />
      </div>

      {user?.wallet_address && (
        <div className="card dashboard-wallet-card">
          <div className="dashboard-wallet-inner">
            <div>
              <div className="label">Ваш кошелёк</div>
              <code className="wallet-address">{user.wallet_address}</code>
            </div>
            <Link to="/profile" className="btn btn-outline btn-sm">
              Открыть профиль
            </Link>
          </div>
        </div>
      )}

      <div className="dashboard-main-grid">
        <div className="card dashboard-section" style={{ gridColumn: "1 / -1" }}>
          <div className="section-header">
            <h2 className="section-title">Последние документы</h2>
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
            <div className="section-empty muted">Пока нет загруженных документов</div>
          )}
        </div>
      </div>

      <div className="card dashboard-section">
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Быстрые действия
        </h2>
        <div className="services-grid">
          <Link to="/upload" className="service-card">
            <div className="service-card-icon">↑</div>
            <h3 className="service-card-title">Загрузка</h3>
            <p className="service-card-desc">Добавить патентный документ</p>
          </Link>
          <Link to="/verify" className="service-card">
            <div className="service-card-icon">✓</div>
            <h3 className="service-card-title">Верификация</h3>
            <p className="service-card-desc">Проверить хэш в реестре</p>
          </Link>
          <Link to="/files" className="service-card">
            <div className="service-card-icon">📁</div>
            <h3 className="service-card-title">Мои патенты</h3>
            <p className="service-card-desc">Список и статусы</p>
          </Link>
          <Link to="/global" className="service-card">
            <div className="service-card-icon">🌐</div>
            <h3 className="service-card-title">Общий реестр</h3>
            <p className="service-card-desc">Поиск по сети</p>
          </Link>
        </div>
      </div>
    </div>
  );
};
