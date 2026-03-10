import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { ActionHistoryTimeline, ActionItem } from "../components/ActionHistoryTimeline";

type Data = {
  id: string;
  file_name: string;
  sha256_hash: string;
  status: string;
  created_at: string;
  description?: string | null;
  blockchain_object_id?: string | null;
  blockchain_tx_hash?: string | null;
  actions: ActionItem[];
};

export const FileDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainInfo, setChainInfo] = useState<any | null>(null);

  const load = async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.get(`/files/${id}/history`);
      setData(res.data);
      setChainInfo(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки");
    }
  };

  const registerOnChain = async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.post(`/blockchain/register/${id}`);
      await load();
      setChainInfo(res.data);
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
          <h2>Детали объекта</h2>
          <div className="bad">{error}</div>
          <button className="btn btn-muted" style={{ marginTop: 12 }} onClick={() => void load()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="container">Loading...</div>;

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Объект</h2>
          <button className="btn btn-primary" onClick={() => void registerOnChain()}>
            Register on-chain
          </button>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div><span className="muted">Name:</span> <strong>{data.file_name}</strong></div>
          <div><span className="muted">SHA-256:</span> <code>{data.sha256_hash}</code></div>
          <div><span className="muted">Created:</span> {new Date(data.created_at).toLocaleString()}</div>
          <div><span className="muted">Status:</span> <code>{data.status}</code></div>
          {data.description && <div><span className="muted">Description:</span> {data.description}</div>}
          {data.blockchain_tx_hash ? (
            <div><span className="muted">Blockchain tx:</span> <code>{data.blockchain_tx_hash}</code></div>
          ) : (
            <div className="muted">Пока не зарегистрировано в блокчейне (только off-chain).</div>
          )}
          {chainInfo?.tx_hash && (
            <div className="ok">On-chain tx: <code>{chainInfo.tx_hash}</code></div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>История действий</h3>
        <div style={{ marginTop: 12 }}>
          <ActionHistoryTimeline items={data.actions} />
        </div>
      </div>
    </div>
  );
};

