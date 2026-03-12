import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ActionHistoryTimeline, ActionItem } from "../components/ActionHistoryTimeline";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "../components/Spinner";

type CertData = {
  is_verified: boolean;
  digital_object_id?: string | null;
  file_name: string | null;
  description?: string | null;
  sha256_hash?: string | null;
  sha256_stored?: string | null;
  transaction_hash?: string | null;
  owner_wallet_address?: string | null;
  registered_at?: string | null;
  blockchain_registered_at?: string | null;
  blockchain_object_id?: string | null;
  status?: string | null;
  integrity_status: string;
  actions?: ActionItem[];
};

const getExplorerUrl = (txHash: string) => {
  const base = import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://explorer.local";
  return `${base}/tx/${txHash}`;
};

type CertificatePageProps = { mode?: "hash" | "id" };

export const CertificatePage: React.FC<CertificatePageProps> = ({ mode: modeProp }) => {
  const { hash, id } = useParams();
  const mode = modeProp ?? (hash ? "hash" : "id");
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = mode === "hash" ? hash : id;
    if (!key) return;
    setLoading(true);
    setError(null);
    const url = mode === "hash"
      ? `/verify/hash/${key}`
      : `/files/${key}/history`;
    api
      .get<CertData>(url)
      .then((r) => {
        const d = r.data as any;
        if (mode === "id" && d) {
          setData({
            is_verified: true,
            digital_object_id: d.id,
            file_name: d.file_name || d.title,
            description: d.description,
            sha256_hash: d.sha256_hash,
            sha256_stored: d.sha256_hash,
            transaction_hash: d.blockchain_tx_hash,
            owner_wallet_address: d.owner_wallet_address,
            registered_at: d.created_at,
            blockchain_registered_at: d.blockchain_registered_at,
            blockchain_object_id: d.blockchain_object_id,
            status: d.status,
            integrity_status: d.blockchain_tx_hash ? "OK" : "NOT_FOUND",
            actions: d.actions || [],
          });
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e?.response?.data?.detail || "Документ не найден"))
      .finally(() => setLoading(false));
  }, [hash, id, mode]);

  const handlePrint = () => window.print();
  const handleExport = () => {
    if (!data) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            document: data.file_name,
            sha256: data.sha256_hash || data.sha256_stored,
            status: data.integrity_status,
            tx_hash: data.transaction_hash,
            owner_wallet: data.owner_wallet_address,
            registered_at: data.registered_at,
            blockchain_registered_at: data.blockchain_registered_at,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `certificate-${data.file_name || "document"}-${Date.now()}.json`;
    a.click();
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: 60 }}>
        <Spinner size={48} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="card">
          <PageHeader title="Сертификат документа" />
          <div className="bad">{error || "Документ не найден"}</div>
          <Link to="/verify" className="btn btn-primary" style={{ marginTop: 16 }}>
            Проверить другой документ
          </Link>
        </div>
      </div>
    );
  }

  if (!data.is_verified) {
    return (
      <div className="page">
        <div className="card certificate-not-found">
          <div className="certificate-status-block certificate-status-block--error">
            <span className="certificate-status-icon">⚠</span>
            <h2>Документ не найден</h2>
            <p className="muted">
              {data.integrity_status === "INVALID_HASH"
                ? "Некорректный формат SHA-256 хэша."
                : "Документ с указанным хэшем не зарегистрирован в реестре BlockProof."}
            </p>
            <Link to="/verify" className="btn btn-outline" style={{ marginTop: 16 }}>
              Проверить другой документ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPublic = resolvedMode === "hash";
  return (
    <div className="page certificate-page">
      {isPublic && (
        <div className="certificate-public-header no-print">
          <Link to="/" className="certificate-public-brand">BlockProof</Link>
          <Link to="/verify" className="btn btn-outline btn-sm">Проверить документ</Link>
        </div>
      )}
      <div className="certificate-actions no-print" style={{ marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={handlePrint}>
          🖨 Печать
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          📥 Экспорт JSON
        </button>
        <Link to="/verify" className="btn btn-muted btn-sm">
          Новая проверка
        </Link>
      </div>

      <div className="certificate-container">
        <div className="certificate-header">
          <div className="certificate-logo">BlockProof</div>
          <div className="certificate-subtitle">Blockchain platform for data verification</div>
          <h1 className="certificate-title">Certificate of Authenticity</h1>
        </div>

        <div className="certificate-status-block certificate-status-block--verified">
          <span className="certificate-status-icon">✓</span>
          <h2>Integrity Confirmed</h2>
          <p>Документ верифицирован и зарегистрирован в реестре</p>
        </div>

        <div className="certificate-sections">
          <section className="certificate-section">
            <h3>Document</h3>
            <dl>
              <dt>Название</dt>
              <dd>{data.file_name || "—"}</dd>
              {data.description && (
                <>
                  <dt>Описание</dt>
                  <dd>{data.description}</dd>
                </>
              )}
              <dt>Статус</dt>
              <dd>
                <StatusBadge status={data.status || "REGISTERED"} />
              </dd>
            </dl>
          </section>

          <section className="certificate-section">
            <h3>Integrity</h3>
            <dl>
              <dt>SHA-256 Hash</dt>
              <dd>
                <code className="certificate-hash">{data.sha256_hash || data.sha256_stored}</code>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => navigator.clipboard.writeText(data.sha256_hash || data.sha256_stored || "")}
                >
                  Копировать
                </button>
              </dd>
            </dl>
          </section>

          <section className="certificate-section">
            <h3>Blockchain Proof</h3>
            <dl>
              {data.transaction_hash ? (
                <>
                  <dt>Tx Hash</dt>
                  <dd>
                    <code>{data.transaction_hash}</code>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => navigator.clipboard.writeText(data.transaction_hash || "")}
                    >
                      Копировать
                    </button>
                    <a
                      href={getExplorerUrl(data.transaction_hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ marginLeft: 8 }}
                    >
                      Explorer
                    </a>
                  </dd>
                  {data.blockchain_registered_at && (
                    <>
                      <dt>On-chain registration</dt>
                      <dd>{new Date(data.blockchain_registered_at).toLocaleString("ru-RU")}</dd>
                    </>
                  )}
                </>
              ) : (
                <dd className="muted">Запись в off-chain реестре (не в блокчейне)</dd>
              )}
            </dl>
          </section>

          <section className="certificate-section">
            <h3>Ownership</h3>
            <dl>
              <dt>Owner Wallet</dt>
              <dd>
                <code>{data.owner_wallet_address || "—"}</code>
              </dd>
              {data.registered_at && (
                <>
                  <dt>Дата регистрации</dt>
                  <dd>{new Date(data.registered_at).toLocaleString("ru-RU")}</dd>
                </>
              )}
            </dl>
          </section>
        </div>

        {data.actions && data.actions.length > 0 && (
          <section className="certificate-section certificate-timeline">
            <h3>История событий</h3>
            <ActionHistoryTimeline items={data.actions} />
          </section>
        )}

        <div className="certificate-footer">
          <p>BlockProof — Blockchain platform for data verification</p>
          <p className="muted" style={{ fontSize: 11 }}>
            Выдано: {new Date().toLocaleString("ru-RU")}
          </p>
        </div>
      </div>
    </div>
  );
};
