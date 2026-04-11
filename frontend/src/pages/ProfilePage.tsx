import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { getRoleLabel } from "../utils/roleLabels";

type ProfileData = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  wallet_status: string;
  document_count: number;
  on_chain_count: number;
  created_at: string;
  university_id?: number | null;
  university_name?: string | null;
};

export const ProfilePage: React.FC = () => {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<ProfileData>("/auth/me");
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading || !data) {
    return (
      <div className="text-center" style={{ padding: 60 }}>
        <Spinner size={40} />
      </div>
    );
  }

  const copyWallet = () => {
    if (data.wallet_address) {
      navigator.clipboard.writeText(data.wallet_address);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Профиль пользователя"
        subtitle="Ваш аккаунт и привязанный blockchain wallet"
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr)" }}>
        <div className="card">
          <div className="label">Учётная запись</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <span className="muted">Email:</span> <strong>{data.email}</strong>
            </div>
            {data.full_name && (
              <div>
                <span className="muted">ФИО:</span> {data.full_name}
              </div>
            )}
            <div>
              <span className="muted">Роль:</span> <strong>{getRoleLabel(data.role)}</strong>
            </div>
            {data.university_name && (
              <div>
                <span className="muted">Университет:</span> {data.university_name}
              </div>
            )}
            <div>
              <span className="muted">Регистрация:</span>{" "}
              {new Date(data.created_at).toLocaleString("ru-RU")}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="label">Blockchain Wallet</div>
          <div className="badge badge-soft-green badge-pill" style={{ marginTop: 8 }}>
            {data.wallet_status === "active" ? "Кошелёк назначен" : "Не назначен"}
          </div>
          {data.wallet_address && (
            <>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <code style={{ fontSize: 12, wordBreak: "break-all" }}>{data.wallet_address}</code>
                <button className="btn btn-outline btn-sm" onClick={copyWallet}>
                  Копировать
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Все ваши документы привязываются к этому адресу при регистрации в блокчейне.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="label">Статистика документов</div>
        <div className="row" style={{ marginTop: 12, gap: 16, flexWrap: "wrap" }}>
          <div className="metric-card" style={{ minWidth: 140 }}>
            <div className="metric-card-value">{data.document_count}</div>
            <div className="metric-card-label">Мои документы</div>
          </div>
          <div className="metric-card" style={{ minWidth: 140 }}>
            <div className="metric-card-value" style={{ color: "var(--color-accent)" }}>
              {data.on_chain_count}
            </div>
            <div className="metric-card-label">Зарегистрировано в блокчейне</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <Link to="/files" className="btn btn-primary btn-sm">
            Мои патенты / документы
          </Link>
          <Link to="/global" className="btn btn-outline btn-sm">
            Реестр
          </Link>
        </div>
      </div>
    </div>
  );
};
