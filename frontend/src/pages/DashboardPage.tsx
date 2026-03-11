import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { MetricCard } from "../components/MetricCard";
import { Spinner } from "../components/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { api } from "../api/client";
import { actionLabels } from "../components/ActionHistoryTimeline";

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

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<FileRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [metricsRes, filesRes, activityRes] = await Promise.all([
        api.get<Metrics>("/files/metrics"),
        api.get<FileRow[]>("/files"),
        api.get<{ actions: ActivityItem[] }>("/files/activity/recent?limit=8"),
      ]);
      setMetrics(metricsRes.data);
      const sorted = [...filesRes.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecent(sorted.slice(0, 5));
      setActivity(activityRes.data.actions || []);
    } catch {
      setMetrics(null);
      setRecent([]);
      setActivity([]);
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
    <div className="page">
      <div className="dashboard-hero">
        <div className="card card-soft dashboard-hero-main">
          <div className="dashboard-hero-main-inner">
            <div className="badge badge-soft-green badge-pill">Защита медицинских записей</div>
            <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 650 }}>
              Добро пожаловать, {user?.email || "пользователь"}
            </h1>
            <div className="muted">
              Защищённая платформа для загрузки, хранения и проверки подлинности медицинских документов.
              Хэши фиксируются в блокчейне — как в современной клинике.
            </div>
            <div className="dashboard-hero-kpi">
              <Link to="/upload" className="btn btn-primary">
                Загрузить документ
              </Link>
              <Link to="/verify" className="btn btn-outline">
                Проверить подлинность
              </Link>
            </div>
          </div>
        </div>

        <div className="card dashboard-hero-secondary">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">Статус платформы</div>
              <div className="muted">Бэкенд и блокчейн-узел активны для демонстрации диплома.</div>
            </div>
            <button className="btn btn-muted btn-sm" onClick={() => void load()}>
              Обновить
            </button>
          </div>
          {loading ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : metrics ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <MetricCard title="Всего документов" value={metrics.total} />
              <MetricCard title="Зарегистрировано on-chain" value={metrics.on_chain} color="var(--color-accent)" />
              <MetricCard title="Успешных проверок" value={metrics.verified} color="var(--color-success)" />
              <MetricCard title="Ошибок проверки" value={metrics.invalid} color="var(--color-danger)" />
            </div>
          ) : (
            <div className="bad">Не удалось загрузить статистику</div>
          )}
          {metrics && (
            <div className="muted" style={{ fontSize: 12 }}>
              Ожидают регистрации в блокчейне:{" "}
              <strong>{pendingOnChain}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="label">Наши услуги</div>
        <div className="services-grid" style={{ marginTop: 12 }}>
          <Link to="/upload" className="service-card">
            <div className="service-card-icon">↑</div>
            <h3 className="service-card-title">Загрузка документов</h3>
            <p className="service-card-desc">Регистрация медицинских файлов off-chain и фиксация хэша</p>
          </Link>
          <Link to="/verify" className="service-card">
            <div className="service-card-icon">✓</div>
            <h3 className="service-card-title">Проверка подлинности</h3>
            <p className="service-card-desc">Верификация документа по файлу или SHA-256 хэшу</p>
          </Link>
          <Link to="/files" className="service-card">
            <div className="service-card-icon">📁</div>
            <h3 className="service-card-title">Мои документы</h3>
            <p className="service-card-desc">Просмотр, статусы и регистрация в блокчейне</p>
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2.2fr)" }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div className="label">Последние документы</div>
              <div className="muted">
                5 последних загруженных медицинских файлов с актуальными статусами целостности.
              </div>
            </div>
            <Link to="/files" className="btn btn-outline btn-sm">
              Открыть все
            </Link>
          </div>
          {loading ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={24} />
            </div>
          ) : recent.length ? (
            <FileTable items={recent} />
          ) : (
            <div className="muted">Пока нет загруженных документов.</div>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div className="label">Последние действия</div>
              <div className="muted">Аудит всех операций с документами</div>
            </div>
            <Link to="/files" className="btn btn-outline btn-sm">
              Все документы
            </Link>
          </div>
          {loading ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={24} />
            </div>
          ) : activity.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {activity.map((a) => (
                <div key={a.id} className="timeline-item" style={{ padding: "10px 0", marginLeft: 8 }}>
                  <div className="timeline-item-content">
                    <div className="timeline-item-type">
                      {actionLabels[a.action_type] || a.action_type}
                      {" · "}
                      <Link to={`/files/${a.object_id}`} style={{ color: "var(--color-primary)" }}>
                        {a.file_name}
                      </Link>
                    </div>
                    <div className="timeline-item-time">
                      {new Date(a.performed_at).toLocaleString("ru-RU")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="timeline-empty">Нет действий.</div>
          )}
        </div>

        <div className="card">
          <div className="label">Краткое объяснение безопасности</div>
          <ul className="page-sidebar-list" style={{ marginTop: 6 }}>
            <li>
              <span className="page-sidebar-dot" />
              Файлы хранятся off-chain в защищённом хранилище (MinIO/локальное S3-совместимое хранилище).
            </li>
            <li>
              <span className="page-sidebar-dot" />
              В блокчейне фиксируются только SHA-256 хэши, владелец и время регистрации — без медицинских данных.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              Проверка документа пересчитывает хэш и сравнивает его с неизменяемой записью в реестре.
            </li>
          </ul>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Такой подход демонстрирует разделение on-chain / off-chain и обеспечивает доказуемую целостность
            медицинских документов без раскрытия их содержания.
          </div>
        </div>
      </div>
    </div>
  );
};

