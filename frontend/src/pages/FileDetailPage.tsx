import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { ActionHistoryTimeline, ActionItem } from "../components/ActionHistoryTimeline";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "../components/Spinner";
import { BlockchainInfoCard } from "../components/BlockchainInfoCard";

import { api as client } from "../api/client";

type Data = {
  id: string;
  file_name: string;
  sha256_hash: string;
  status: string;
  created_at: string;
  description?: string | null;
  blockchain_object_id?: string | null;
  blockchain_tx_hash?: string | null;
  owner_id: string;
  storage_key?: string;
  actions: ActionItem[];
};

export const FileDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainActions, setChainActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/files/${id}/history`);
      setData(res.data);
      // fetch download link
      try {
        const dres = await api.get(`/files/${id}/download`);
        setDownloadUrl(dres.data.url);
      } catch {}
      // if object has on-chain id, load history
      if (res.data.blockchain_object_id) {
        try {
          const hres = await api.get(`/blockchain/object/${res.data.blockchain_object_id}/history`);
          // map to generic ActionItem shape
          const mapped = (hres.data || []).map((a: any) => ({
            action_type: a.action_type,
            performed_at: a.timestamp,
            details: a.details,
          }));
          setChainActions(mapped);
        } catch {}
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
      const res = await api.post(`/blockchain/register/${id}`);
      await load();
      // optionally show tx
      setChainActions([]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка регистрации в блокчейне");
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (error) {
    return (
      <div className="grid">
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

  return (
    <div className="grid">
      <PageHeader
        title="Документ"
        subtitle={data.file_name}
        actions={
          <button className="btn btn-primary" onClick={() => void registerOnChain()}>
            Зарегистрировать в блокчейне
          </button>
        }
      />

      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="muted">Имя файла:</span> <strong>{data.file_name}</strong>
              {downloadUrl && (
                <a href={downloadUrl} target="_blank" className="btn btn-outline" style={{ fontSize: 12 }}>
                  Скачать
                </a>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="muted">SHA-256:</span> <code>{data.sha256_hash}</code>
              <button
                className="btn btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => navigator.clipboard.writeText(data.sha256_hash)}
              >
                Copy
              </button>
            </div>
            <div>
              <span className="muted">Создан:</span> {new Date(data.created_at).toLocaleString()}
            </div>
            <div>
              <span className="muted">Статус:</span>{" "}
              <StatusBadge status={data.status} />
            </div>
            {data.description && (
              <div>
                <span className="muted">Описание:</span> {data.description}
              </div>
            )}
          </div>
          <div>
            <h4>Blockchain proof</h4>
          <BlockchainInfoCard
            txHash={data.blockchain_tx_hash}
            objectId={data.blockchain_object_id}
          />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>История действий (off-chain)</h3>
        <div style={{ marginTop: 12 }}>
          <ActionHistoryTimeline items={data.actions} />
        </div>
      </div>

      {chainActions.length > 0 && (
        <div className="card">
          <h3>История действий (blockchain)</h3>
          <div style={{ marginTop: 12 }}>
            <ActionHistoryTimeline items={chainActions} />
          </div>
        </div>
      )}
    </div>
  );
};

