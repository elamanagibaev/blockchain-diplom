import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useNotification } from "../context/NotificationContext";

type UploadResult = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  blockchain_object_id: string | null;
  blockchain_tx_hash: string | null;
};

export const UploadPage: React.FC = () => {
  const { notify } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
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
      const res = await api.post<UploadResult>("/files/upload", form);
      setResult(res.data);
      notify("success", "Документ успешно загружен и зарегистрирован off-chain.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка загрузки";
      setError(msg);
      notify("error", typeof msg === "string" ? msg : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="page">
      <PageHeader
        title="Загрузка медицинского документа"
        subtitle="Загрузите PDF, изображение или другой медицинский файл. Платформа вычислит SHA-256 хэш и сохранит контрольную запись."
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2.2fr)" }}>
        <div className="card">
          <div className="badge badge-soft-blue badge-pill" style={{ marginBottom: 10 }}>
            Step 1 · Upload off-chain
          </div>
          <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
            <div>
              <div className="label">Файл (PDF, изображения, текст)</div>
              <input
                className="input"
                type="file"
                accept="application/pdf,image/*,text/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <div className="label">Описание (тип документа, пациент, контекст)</div>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: Выписка из стационара, Петров И.И., дата госпитализации..."
              />
            </div>
            {error && <div className="bad">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Загрузка..." : "Загрузить и зафиксировать хэш"}
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Файл сохраняется в защищённом off-chain хранилище, а его SHA-256 хэш и метаданные — в базе
              данных. На этом шаге запись в блокчейн ещё не создаётся.
            </div>
          </form>
        </div>

        <div className="card">
          <div className="label">Модель потока документа</div>
          <ul className="page-sidebar-list" style={{ marginTop: 6 }}>
            <li>
              <span className="page-sidebar-dot" />
              <strong>Upload</strong> — файл попадает в off-chain хранилище, создаётся запись в
              <code>digital_objects</code>.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              <strong>Register on-chain</strong> — администратор регистрирует объект в контракте{" "}
              <code>FileRegistry</code>, фиксируя хэш и владельца.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              <strong>Verify</strong> — пациент, врач или аудитор загружает файл или хэш и получает proof of
              authenticity.
            </li>
          </ul>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div className="label">Документ успешно зарегистрирован off-chain</div>
              <div className="muted">
                На следующем шаге зарегистрируйте документ в блокчейне.{" "}
                <Link to={`/files/${result.id}`} style={{ color: "var(--color-primary)" }}>
                  Открыть детали →
                </Link>
              </div>
            </div>
            <StatusBadge status={result.status} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr)" }}>
            <div>
              <div>
                <span className="muted">Object ID:</span> <code>{result.id}</code>
              </div>
              <div>
                <span className="muted">Имя файла:</span> {result.file_name}
              </div>
              <div>
                <span className="muted">Тип:</span> {result.mime_type}
              </div>
              <div>
                <span className="muted">Размер:</span> {formatSize(result.size_bytes)}
              </div>
            </div>
            <div>
              <div>
                <span className="muted">SHA-256:</span> <code>{result.sha256_hash}</code>
              </div>
              <div>
                <span className="muted">Создан:</span>{" "}
                {new Date(result.created_at).toLocaleString()}
              </div>
              <div>
                <span className="muted">On-chain:</span>{" "}
                {result.blockchain_tx_hash ? (
                  <code>{result.blockchain_tx_hash}</code>
                ) : (
                  <span className="muted">ещё не зарегистрирован</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

