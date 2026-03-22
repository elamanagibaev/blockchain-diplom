import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "../components/Spinner";
import { BlockchainInfoCard } from "../components/BlockchainInfoCard";

type Data = {
  id: string;
  file_name: string;
  title?: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  description?: string | null;
  blockchain_object_id?: string | null;
  blockchain_tx_hash?: string | null;
  blockchain_registered_at?: string | null;
  owner_id: string;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
  storage_key?: string;
  document_type?: string | null;
};

export const FileDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferWallet, setTransferWallet] = useState("");
  const [downloading, setDownloading] = useState(false);
  const { notify } = useNotification();
  const { user } = useAuth();

  const handleDownload = async () => {
    if (!id || !data) return;
    setDownloading(true);
    try {
      const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file_name || "document";
      a.click();
      URL.revokeObjectURL(url);
      notify("success", "Файл скачан");
    } catch (err: any) {
      let msg = "Ошибка скачивания";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || msg;
        } catch {
          // ignore
        }
      } else if (typeof data?.detail === "string") {
        msg = data.detail;
      } else if (Array.isArray(data?.detail)) {
        msg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
      }
      notify("error", msg);
    } finally {
      setDownloading(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Data>(`/files/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const submitForRegistration = async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/files/${id}/submit-for-registration`);
      await load();
      notify("success", "Документ отправлен на рассмотрение и отображается в общем реестре.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка отправки заявки";
      notify("error", typeof msg === "string" ? msg : "Ошибка отправки заявки");
    } finally {
      setSubmitting(false);
    }
  };

  const transferDocument = async () => {
    if (!id || !transferWallet.trim()) return;
    setTransferring(true);
    setError(null);
    try {
      await api.post(`/files/${id}/transfer`, { to_wallet_address: transferWallet.trim() });
      setTransferWallet("");
      notify("success", "Документ передан.");
      try {
        const res = await api.get<Data>(`/files/${id}`);
        setData(res.data);
      } catch (reloadErr: any) {
        if (reloadErr?.response?.status === 403) {
          navigate("/files");
        } else {
          const msg = reloadErr?.response?.data?.detail || "Ошибка обновления данных";
          setError(typeof msg === "string" ? msg : "Ошибка обновления данных");
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка передачи";
      notify("error", typeof msg === "string" ? msg : "Ошибка передачи");
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <PageHeader title="Детали документа" />
          <div className="bad">{error}</div>
          <button className="btn btn-muted" style={{ marginTop: 12 }} onClick={() => void load()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="text-center" style={{ marginTop: 60 }}>
        <Spinner size={48} />
      </div>
    );
  }

  const onChainRegistered = Boolean(data.blockchain_tx_hash);
  const canSubmit = !onChainRegistered && ["UPLOADED", "REGISTERED", "REJECTED"].includes(data.status);
  const isOwner = user?.id === data.owner_id || user?.role === "admin";

  const docDisplayName =
    data.description?.trim() || data.title?.trim() || data.file_name;

  return (
    <div className="page">
      <PageHeader
        title="Патентный документ"
        subtitle={docDisplayName}
        backTo={{ to: "/files", label: "Мои патенты" }}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {onChainRegistered ? null : canSubmit ? (
              <button
                type="button"
                className="btn-review"
                onClick={() => void submitForRegistration()}
                disabled={submitting}
              >
                {submitting ? "Отправка…" : "Рассмотреть"}
              </button>
            ) : data.status === "PENDING_APPROVAL" ? (
              <span className="muted" style={{ fontSize: 14 }}>Ожидает одобрения администратора</span>
            ) : null}
            <Link to={`/certificate/${data.id}`} className="btn btn-outline btn-sm">
              Открыть сертификат
            </Link>
          </div>
        }
      />
      {!data.description?.trim() && (
        <p className="file-row-desc-hint" style={{ marginTop: 6, marginBottom: 14 }}>
          Добавьте название документа
        </p>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2.2fr)" }}>
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>Метаданные</h2>
          <div className="grid" style={{ marginTop: 8, gap: 8 }}>
            <div>
              <span className="muted">ID объекта:</span> <code>{data.id}</code>
            </div>
            <div>
              <span className="muted">Имя файла:</span> <strong>{data.file_name}</strong>
              {isOwner && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                >
                  {downloading ? "Скачивание…" : "Скачать"}
                </button>
              )}
            </div>
            <div>
              <span className="muted">Статус:</span>{" "}
              <StatusBadge
                labelPreset="patents"
                status={
                  data.status === "REGISTERED" && !data.blockchain_tx_hash
                    ? "UPLOADED"
                    : data.status
                }
              />
            </div>
            <div>
              <span className="muted">Загружен:</span> {new Date(data.created_at).toLocaleString()}
            </div>
            {data.blockchain_registered_at && (
              <div>
                <span className="muted">Зарегистрирован в блокчейне:</span>{" "}
                {new Date(data.blockchain_registered_at).toLocaleString()}
              </div>
            )}
            <div>
              <span className="muted">Владелец:</span>{" "}
              {data.owner_email || data.owner_id}
            </div>
            {data.owner_wallet_address && (
              <div>
                <span className="muted">Wallet владельца:</span>{" "}
                <code style={{ fontSize: 12 }}>{data.owner_wallet_address}</code>
              </div>
            )}
            {data.description && (
              <div>
                <span className="muted">Описание:</span> {data.description}
              </div>
            )}
            {data.storage_key && (
              <div>
                <span className="muted">Storage key (off-chain):</span>{" "}
                <code>{data.storage_key}</code>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>Правообладатель</h2>
          <div style={{ marginTop: 8 }}>
            <div><span className="muted">Владелец:</span> {data.owner_email || data.owner_id}</div>
            {data.owner_wallet_address && (
              <div style={{ marginTop: 4 }}>
                <span className="muted">Wallet address:</span>{" "}
                <code style={{ fontSize: 12 }}>{data.owner_wallet_address}</code>
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              При регистрации в блокчейне запись привязывается к кошельку правообладателя.
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>Блокчейн</h2>
          <div style={{ marginTop: 8 }}>
            <BlockchainInfoCard
              txHash={data.blockchain_tx_hash}
              objectId={data.blockchain_object_id}
            />
          </div>
        </div>
      </div>

      {isOwner && data.blockchain_tx_hash && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Передача прав</h2>
          <div className="muted" style={{ fontSize: 12 }}>
            Укажите адрес кошелька нового правообладателя. Аккаунт с этим адресом должен быть зарегистрирован в системе.
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                className="input"
                placeholder="0x… (адрес кошелька получателя)"
                value={transferWallet}
                onChange={(e) => setTransferWallet(e.target.value)}
              />
            </div>
            <button
              className="btn btn-outline"
              onClick={() => void transferDocument()}
              disabled={transferring || !transferWallet.trim()}
            >
              {transferring ? "Передача…" : "Передать права"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

