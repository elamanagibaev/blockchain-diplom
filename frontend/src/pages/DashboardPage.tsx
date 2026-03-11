import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { MetricCard } from "../components/MetricCard";
import { Spinner } from "../components/Spinner";
import { api } from "../api/client";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/files/metrics");
      setMetrics(res.data);
    } catch (e) {
      // ignore for now
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid">
      <PageHeader
        title="Добро пожаловать в MediChain Records"
        subtitle="Защищённая платформа для хранения и проверки медицинских документов"
      />

      {loading ? (
        <div className="text-center mt-16">
          <Spinner size={48} />
        </div>
      ) : metrics ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <MetricCard title="Всего документов" value={metrics.total} />
          <MetricCard title="Проверено" value={metrics.verified} color="var(--color-success)" />
          <MetricCard title="На блокчейне" value={metrics.on_chain} color="var(--color-accent)" />
          <MetricCard title="Ожидают on-chain" value={metrics.total - metrics.on_chain} color="var(--color-primary)" />
          <MetricCard title="Ошибки вериф." value={metrics.invalid} color="var(--color-danger)" />
        </div>
      ) : (
        <div className="bad">Не удалось загрузить статистику</div>
      )}

      <div className="card">
        <p className="muted">
          Пользователь: <strong>{user?.email}</strong> (роль: <code>{user?.role}</code>)
        </p>
      </div>
    </div>
  );
};

