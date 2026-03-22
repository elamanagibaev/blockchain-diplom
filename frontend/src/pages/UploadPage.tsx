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
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError("Введите название документа");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("upload_file", file);
      form.append("description", trimmedDesc);
      const res = await api.post<UploadResult>("/files/upload", form);
      setResult(res.data);
      notify("success", "Документ загружен, хэш зафиксирован во внутреннем реестре.");
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
        title="Загрузка патентного документа"
        subtitle="PDF, DOC, DOCX, изображение или текстовый файл. Укажите название документа — оно будет отображаться в реестре."
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2.2fr)" }}>
        <div className="card">
          <div className="badge badge-soft-blue badge-pill" style={{ marginBottom: 10 }}>
            Шаг 1 · Загрузка файла
          </div>
          <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
            <div>
              <div className="label">Файл</div>
              <input
                className="input"
                type="file"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/*,.pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Поддерживаемые форматы: PDF, DOC, DOCX, изображения, текст.
              </div>
            </div>
            <div>
              <div className="label">
                Название документа <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(обязательно)</span>
              </div>
              <textarea
                className="input"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: заявка на изобретение №…, «Способ…», дата подачи…"
              />
            </div>
            {error && <div className="bad">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Загрузка…" : "Загрузить и зафиксировать хэш"}
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Файл сохраняется в защищённом хранилище, хэш и метаданные — в базе. Запись в блокчейне создаётся после
              одобрения администратором.
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.05rem" }}>
            Как устроен процесс
          </h2>
          <ol
            style={{
              margin: "12px 0 0",
              paddingLeft: 22,
              lineHeight: 1.55,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            <li style={{ marginBottom: 12 }}>
              Вы выбираете файл на устройстве: он сохраняется в защищённом хранилище платформы, в базе создаётся запись с
              именем, типом и вычисленным хэшем. На этом шаге блокчейн ещё не используется.
            </li>
            <li style={{ marginBottom: 12 }}>
              Чтобы закрепить хэш в распределённом реестре, вы подаёте заявку из карточки документа. Администратор
              проверяет её и при одобрении отправляет транзакцию в смарт-контракт: в сеть попадают только хэш, идентификатор
              объекта и адрес кошелька правообладателя.
            </li>
            <li>
              Любой участник может позже загрузить тот же файл или указать его хэш на странице верификации: система
              сравнит данные с реестром и покажет, совпадает ли документ с записью.
            </li>
          </ol>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div className="label">Документ сохранён во внутреннем реестре</div>
              <div className="muted">
                Для фиксации в блокчейне подайте заявку из карточки документа.{" "}
                <Link to={`/files/${result.id}`} style={{ color: "var(--color-primary)" }}>
                  Открыть карточку →
                </Link>
              </div>
            </div>
            <StatusBadge labelPreset="patents" status={result.status} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr)" }}>
            <div>
              <div>
                <span className="muted">ID объекта:</span> <code>{result.id}</code>
              </div>
              <div>
                <span className="muted">Название документа:</span> {result.description || "—"}
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
                <span className="muted">Создан:</span> {new Date(result.created_at).toLocaleString()}
              </div>
              <div>
                <span className="muted">В блокчейне:</span>{" "}
                {result.blockchain_tx_hash ? (
                  <code>{result.blockchain_tx_hash}</code>
                ) : (
                  <span className="muted">пока нет</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
