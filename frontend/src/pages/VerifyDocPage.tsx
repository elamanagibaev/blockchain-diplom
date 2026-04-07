import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Spinner } from "../components/ui/Spinner";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type PublicVerify = {
  document_id: string;
  status: string;
  owner_email?: string | null;
  owner_wallet_address?: string | null;
  registration_timestamp?: string | null;
  hash_short: string;
  verify_url: string;
  is_authentic: boolean;
};

export const VerifyDocPage: React.FC = () => {
  const { docId } = useParams();
  const [data, setData] = useState<PublicVerify | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    void fetch(`${apiBase}/verify/${docId}`)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.json().catch(() => ({}));
          throw new Error((t as { detail?: string }).detail || r.statusText);
        }
        return r.json() as Promise<PublicVerify>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return (
      <div className="public-verify-shell">
        <header className="public-verify-header">
          <div className="public-verify-brand">
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #FCD535, #F0B90B)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#181A20",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              B
            </span>
            <span>BlockProof</span>
          </div>
        </header>
        <div className="public-verify-main" style={{ textAlign: "center", paddingTop: 48 }}>
          <Spinner size={40} />
          <p className="muted" style={{ marginTop: 16 }}>
            Загрузка справки…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-verify-shell">
        <header className="public-verify-header">
          <div className="public-verify-brand">
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #FCD535, #F0B90B)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#181A20",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              B
            </span>
            <span>BlockProof</span>
          </div>
          <Link to="/verify" className="btn btn-outline btn-sm">
            Проверка по файлу
          </Link>
        </header>
        <div className="public-verify-main">
          <div className={`proof-result-shell proof-result-shell--invalid public-proof-card`}>
            <div className="proof-banner">
              <div className="proof-banner__icon" aria-hidden>
                ✕
              </div>
              <div>
                <h2 className="proof-banner__title">Документ недоступен</h2>
                <p className="proof-banner__sub">{error || "Не найдено"}</p>
              </div>
            </div>
            <div className="proof-body">
              <Link to="/login" className="btn btn-muted">
                Войти в систему
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shellClass = data.is_authentic
    ? "proof-result-shell proof-result-shell--valid"
    : "proof-result-shell proof-result-shell--unknown";

  return (
    <div className="public-verify-shell">
      <header className="public-verify-header">
        <div className="public-verify-brand">
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #FCD535, #F0B90B)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#181A20",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            B
          </span>
          <span>BlockProof — публичная справка</span>
        </div>
        <Link to="/verify" className="btn btn-outline btn-sm">
          Полная верификация
        </Link>
      </header>

      <main className="public-verify-main">
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.5 }}>
          Подлинность файла по содержимому подтверждается на странице{" "}
          <Link to="/verify" style={{ color: "var(--color-primary)" }}>
            верификации
          </Link>{" "}
          (SHA-256). Ниже — справочные данные по идентификатору в системе.
        </p>

        <div className={`${shellClass} public-proof-card`}>
          <div className="proof-banner">
            <div className="proof-banner__icon" aria-hidden>
              {data.is_authentic ? "✓" : "!"}
            </div>
            <div>
              <h1 className="proof-banner__title" style={{ fontSize: "1.15rem" }}>
                {data.is_authentic ? "Объект в реестре (on-chain)" : "Справка по записи"}
              </h1>
              <p className="proof-banner__sub">
                Статус в системе: <strong>{data.status}</strong>
                {" · "}
                Подлинность on-chain:{" "}
                <strong className={data.is_authentic ? "ok" : "bad"}>{data.is_authentic ? "да" : "нет"}</strong>
              </p>
            </div>
          </div>

          <div className="proof-body">
            <div className="proof-grid">
              <div className="proof-kv">
                <span className="muted">Владелец (email)</span>
                <div style={{ marginTop: 6 }}>{data.owner_email || "—"}</div>
              </div>
              <div className="proof-kv">
                <span className="muted">Кошелёк</span>
                <div style={{ marginTop: 6 }}>
                  {data.owner_wallet_address ? (
                    <code style={{ fontSize: 12 }}>{data.owner_wallet_address}</code>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="proof-kv">
                <span className="muted">Дата регистрации / учёта</span>
                <div style={{ marginTop: 6 }}>
                  {data.registration_timestamp ? new Date(data.registration_timestamp).toLocaleString() : "—"}
                </div>
              </div>
              <div className="proof-kv">
                <span className="muted">SHA-256 (фрагмент)</span>
                <div style={{ marginTop: 6 }}>
                  <code>{data.hash_short}</code>
                </div>
              </div>
              <div className="proof-kv" style={{ gridColumn: "1 / -1" }}>
                <span className="muted">Идентификатор</span>
                <div style={{ marginTop: 6 }}>
                  <code>{data.document_id}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
