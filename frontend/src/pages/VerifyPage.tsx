import React, { useState } from "react";
import { api } from "../api/client";

export const VerifyPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Выберите файл для проверки");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("upload_file", file);
      const res = await api.post("/verify/file", form);
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка проверки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <h2>Проверка подлинности</h2>
        <p className="muted">Файл повторно загружается, backend считает SHA-256 и сравнивает с реестром.</p>
        <form onSubmit={submit} className="grid" style={{ marginTop: 16 }}>
          <div>
            <div className="label">Файл</div>
            <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Проверка..." : "Проверить"}
          </button>
        </form>
      </div>

      {result && (
        <div className="card">
          <h3>Результат</h3>
          <div style={{ marginTop: 12 }}>
            {result.is_verified ? (
              <div className="ok"><strong>VERIFIED</strong> — хэш найден в реестре</div>
            ) : (
              <div className="bad"><strong>NOT VERIFIED</strong> — хэш не найден</div>
            )}
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            {result.digital_object_id && <div><span className="muted">Object ID:</span> <code>{result.digital_object_id}</code></div>}
            {result.file_name && <div><span className="muted">Original name:</span> {result.file_name}</div>}
            {result.owner_id && <div><span className="muted">Owner (user id):</span> <code>{result.owner_id}</code></div>}
            {result.registered_at && <div><span className="muted">Registered at:</span> {new Date(result.registered_at).toLocaleString()}</div>}
            {result.transaction_hash && <div><span className="muted">Blockchain tx:</span> <code>{result.transaction_hash}</code></div>}
            <div><span className="muted">Integrity status:</span> <code>{result.integrity_status}</code></div>
          </div>
        </div>
      )}
    </div>
  );
};

