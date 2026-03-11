import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import { ActionHistoryTimeline, ActionItem } from "../components/ActionHistoryTimeline";
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
  actions: ActionItem[];
};

export const FileDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainActions, setChainActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { notify } = useNotification();

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Data>(`/files/${id}/history`);
      const dto = res.data as any;
      setData(dto);
      try {
        const dres = await api.get<{ url: string }>(`/files/${id}/download`);
        setDownloadUrl(dres.data.url);
      } catch {
        setDownloadUrl(null);
      }
      if (dto.blockchain_object_id) {
        try {
          const hres = await api.get<any[]>(`/blockchain/object/${dto.blockchain_object_id}/history`);
          const mapped: ActionItem[] = (hres.data || []).map((a: any) => ({
            action_type: a.action_type,
            performed_at: a.timestamp,
            details: a.details,
          }));
          setChainActions(mapped);
        } catch {
          setChainActions([]);
        }
      } else {
        setChainActions([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const registerOnChain = async () => {
    if (!id) return;
    setError(null);
    try {
      await api.post(`/blockchain/register/${id}`);
      await load();
      notify("success", "Документ зарегистрирован в блокчейне.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка регистрации в блокчейне";
      setError(msg);
      notify("error", typeof msg === "string" ? msg : "Ошибка регистрации");
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

  return (
    <div className="page">
      <PageHeader
        title="Медицинский документ"
        subtitle={data.title || data.file_name}
        backTo={{ to: "/files", label: "Мои патенты" }}
        actions={
          <button className="btn btn-primary" onClick={() => void registerOnChain()}>
            {onChainRegistered ? "Повторно зарегистрировать on-chain" : "Зарегистрировать в блокчейне"}
          </button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2.2fr)" }}>
        <div className="card">
          <div className="label">Метаданные документа</div>
          <div className="grid" style={{ marginTop: 8, gap: 8 }}>
            <div>
              <span className="muted">ID объекта:</span> <code>{data.id}</code>
            </div>
            <div>
              <span className="muted">Имя файла:</span> <strong>{data.file_name}</strong>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8 }}
                >
                  Скачать
                </a>
              )}
            </div>
            <div>
              <span className="muted">Статус:</span>{" "}
              <StatusBadge
                status={
                  data.status === "REGISTERED" && !data.blockchain_tx_hash
                    ? "PENDING_ON_CHAIN"
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
          <div className="label">Ownership — владение документом</div>
          <div style={{ marginTop: 8 }}>
            <div><span className="muted">Владелец:</span> {data.owner_email || data.owner_id}</div>
            {data.owner_wallet_address && (
              <div style={{ marginTop: 4 }}>
                <span className="muted">Wallet address:</span>{" "}
                <code style={{ fontSize: 12 }}>{data.owner_wallet_address}</code>
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              При регистрации в блокчейне документ привязывается к wallet-адресу владельца.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="label">Integrity — целостность</div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="muted">SHA-256 хэш:</span> <code>{data.sha256_hash}</code>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigator.clipboard.writeText(data.sha256_hash)}
              >
                Скопировать
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Любое изменение файла приведёт к смене хэша и нарушению соответствия с on-chain записью.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="label">Blockchain proof</div>
          <div style={{ marginTop: 8 }}>
            <BlockchainInfoCard
              txHash={data.blockchain_tx_hash}
              objectId={data.blockchain_object_id}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>История действий (off-chain аудит)</h3>
        <div className="muted" style={{ fontSize: 12 }}>
          Каждое действие с документом (загрузка, изменение статуса, регистрация on-chain) фиксируется в базе
          данных и может быть предъявлено в качестве аудиторского следа.
        </div>
        <div style={{ marginTop: 12 }}>
          <ActionHistoryTimeline items={data.actions} />
        </div>
      </div>

      {chainActions.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>История действий (blockchain)</h3>
          <div className="muted" style={{ fontSize: 12 }}>
            Эти события получены напрямую из контракта <code>FileRegistry</code> и демонстрируют неизменяемый
            on-chain след.
          </div>
          <div style={{ marginTop: 12 }}>
            <ActionHistoryTimeline items={chainActions} />
          </div>
        </div>
      )}
    </div>
  );
};

