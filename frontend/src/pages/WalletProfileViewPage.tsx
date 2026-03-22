import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";

type Lookup = {
  id: string;
  email: string;
  wallet_address: string | null;
};

export const WalletProfileViewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const wallet = searchParams.get("w")?.trim() || "";
  const [data, setData] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) {
      setError("Адрес кошелька не указан");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<Lookup>(`/auth/wallet/${encodeURIComponent(wallet)}/lookup`)
      .then((r) => setData(r.data))
      .catch(() => {
        setData(null);
        setError("Пользователь с таким кошельком не найден в системе.");
      })
      .finally(() => setLoading(false));
  }, [wallet]);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: 60 }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="card">
          <PageHeader title="Профиль по кошельку" />
          <div className="bad">{error || "Нет данных"}</div>
          <Link to="/global" className="btn btn-outline" style={{ marginTop: 16 }}>
            К общей базе
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Учётная запись" subtitle="Данные из реестра пользователей" />
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="label">Электронная почта</div>
        <div style={{ marginTop: 6, fontSize: 16 }}>{data.email}</div>
        {data.wallet_address && (
          <>
            <div className="label" style={{ marginTop: 16 }}>
              Кошелёк
            </div>
            <code style={{ fontSize: 13, wordBreak: "break-all", display: "block", marginTop: 6 }}>
              {data.wallet_address}
            </code>
          </>
        )}
        <Link to="/global" className="btn btn-outline btn-sm" style={{ marginTop: 20 }}>
          Назад к реестру
        </Link>
      </div>
    </div>
  );
};
