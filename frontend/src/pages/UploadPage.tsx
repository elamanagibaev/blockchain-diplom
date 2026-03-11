import React, { useState } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Выберите файл");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("upload_file", file);
      if (description) form.append("description", description);
      const res = await api.post("/files/upload", form);
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <PageHeader title="Загрузка документа" subtitle="Зарегистрируйте медицинский файл" />
      <div className="card">
        <p className="muted">Backend вычисляет SHA-256, сохраняет файл off-chain и метаданные в PostgreSQL.</p>
        <form onSubmit={submit} className="grid" style={{ marginTop: 16 }}>
          <div>
            <div className="label">Файл</div>
            <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <div className="label">Описание (опционально)</div>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Загрузка..." : "Загрузить"}
          </button>
        </form>
      </div>

      {result && (
        <div className="card">
          <h3>Результат</h3>
          <div className="grid" style={{ marginTop: 12 }}>
            <div>
              <span className="muted">Object ID:</span> <code>{result.id}</code>
            </div>
            <div>
              <span className="muted">SHA-256:</span> <code>{result.sha256_hash}</code>
            </div>
            <div>
              <span className="muted">Status:</span>{" "}
              <StatusBadge status={result.status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

