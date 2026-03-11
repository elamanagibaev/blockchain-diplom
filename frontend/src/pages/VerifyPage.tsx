import React, { useState } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";

export const VerifyPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file && !hash) {
      setError("Выберите файл или введите хэш");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (hash && !file) {
        res = await api.get(`/verify/hash/${hash}`);
      } else {
        const form = new FormData();
        if (file) form.append("upload_file", file);
        res = await api.post("/verify/file", form);
      }
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка проверки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <PageHeader title="Проверка документа" subtitle="Загрузите файл, чтобы убедиться в его подлинности" />

      <div className="card">
        <form onSubmit={submit} className="grid" style={{ marginTop: 16 }}>
          <div>
            <div className="label">Файл</div>
            <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div style={{ textAlign: "center", margin: "8px 0" }}>или</div>
          <div>
            <div className="label">SHA-256 хэш</div>
            <input
              className="input"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
            />
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <><Spinner size={16} /> Проверка...</> : "Проверить"}
          </button>
        </form>
      </div>

      {result && (
        <div className="card">
          <h3>Результат</h3>
          <div style={{ marginTop: 12 }}>
            {result.is_verified ? (
              <div className="ok">
                <strong>VERIFIED</strong> <StatusBadge status="VERIFIED" />
              </div>
            ) : (
              <div className="bad">
                <strong>NOT VERIFIED</strong> <StatusBadge status="NOT_VERIFIED" />
              </div>
            )}
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            {result.digital_object_id && (
              <div>
                <span className="muted">Object ID:</span> <code>{result.digital_object_id}</code>
              </div>
            )}
            {result.file_name && (
              <div>
                <span className="muted">Имя:</span> {result.file_name}
              </div>
            )}
            {result.owner_id && (
              <div>
                <span className="muted">Владелец:</span> <code>{result.owner_id}</code>
              </div>
            )}
            {result.registered_at && (
              <div>
                <span className="muted">Зарегистрирован:</span>{" "}
                {new Date(result.registered_at).toLocaleString()}
              </div>
            )}
            {result.transaction_hash && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="muted">Blockchain tx:</span>{" "}
                <code>{result.transaction_hash}</code>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 12 }}
                  onClick={() => navigator.clipboard.writeText(result.transaction_hash)}
                >
                  Copy
                </button>
              </div>
            )}
            <div>
              <span className="muted">Integrity status:</span>{" "}
              <StatusBadge status={result.integrity_status} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                const text = JSON.stringify(result, null, 2);
                navigator.clipboard.writeText(text);
              }}
              style={{ fontSize: 12 }}
            >
              Copy report
            </button>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

