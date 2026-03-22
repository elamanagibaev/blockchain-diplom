import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useNotification } from "../context/NotificationContext";

type VerificationResult = {
  is_verified: boolean;
  digital_object_id: string | null;
  registered_at: string | null;
  owner_id: string | null;
  file_name: string | null;
  description: string | null;
  transaction_hash: string | null;
  integrity_status: string;
  sha256_hash?: string | null;
  sha256_stored?: string | null;
};

export const VerifyPage: React.FC = () => {
  const { notify } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file && !hash) {
      setError("Выберите файл или введите SHA-256");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (hash && !file) {
        res = await api.get<VerificationResult>(`/verify/hash/${hash}`);
      } else {
        const form = new FormData();
        if (file) form.append("upload_file", file);
        res = await api.post<VerificationResult>("/verify/file", form);
      }
      setResult(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка проверки";
      setError(msg);
      notify("error", typeof msg === "string" ? msg : "Ошибка проверки");
    } finally {
      setLoading(false);
    }
  };

  const integrityLabel = (status: string) => {
    switch (status) {
      case "OK":
        return "Хэш совпадает с записью в реестре.";
      case "NOT_FOUND":
        return "Документ с таким хэшем не найден.";
      case "INVALID_HASH":
        return "Некорректный формат SHA-256 (ожидается 64 шестнадцатеричных символа).";
      default:
        return "Статус проверки целостности.";
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Верификация патентного документа"
        subtitle="Загрузите файл или укажите SHA-256, чтобы сравнить хэш с реестром BlockProof."
      />

      <div className="verify-layout">
        <div className="card">
          <div className="badge badge-soft-blue badge-pill" style={{ marginBottom: 10 }}>
            Верификация
          </div>
          <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
            <div>
              <div className="label">Файл для проверки</div>
              <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div style={{ textAlign: "center", margin: "4px 0", fontSize: 12 }} className="muted">
              или укажите известный SHA-256
            </div>
            <div>
              <div className="label">SHA-256 (64 символа)</div>
              <input
                className="input"
                value={hash}
                onChange={(e) => setHash(e.target.value.trim())}
                placeholder="Вставьте полный хэш SHA-256"
              />
            </div>
            {error && <div className="bad">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size={16} /> Проверка…
                </>
              ) : (
                "Верифицировать"
              )}
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Файл целиком не отправляется в блокчейн: для сравнения используется только вычисленный хэш.
            </div>
          </form>
        </div>

        <div className="card">
          <div className="label">Как это работает</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            1. Для файла вычисляется SHA-256. <br />
            2. Хэш сравнивается с записями в базе и при наличии — с реестром <code>FileRegistry</code>. <br />
            3. Вы получаете статус и при успехе — ссылку на сертификат и данные on-chain.
          </div>
          <ul className="page-sidebar-list" style={{ marginTop: 10 }}>
            <li>
              <span className="page-sidebar-dot" />
              В сети хранятся только хэш, идентификатор объекта и кошелёк правообладателя — без содержимого файла.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              Любое изменение файла меняет хэш; проверка покажет несоответствие.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              Результат можно скопировать или распечатать для приложения к делу или отчёту.
            </li>
          </ul>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="label">Результат проверки</div>
              <div className="muted">
                {result.is_verified
                  ? "Документ найден в реестре BlockProof."
                  : "Документ не найден или хэш не совпадает с реестром."}
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <StatusBadge status={result.is_verified ? "VERIFIED" : "NOT_VERIFIED"} />
              {result.is_verified && result.sha256_hash && (
                <Link to={`/verify/hash/${result.sha256_hash}`} className="btn btn-outline btn-sm">
                  Открыть сертификат
                </Link>
              )}
            </div>
          </div>

          <div className="verify-result-grid" style={{ marginTop: 8 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="label">Целостность</div>
              <div style={{ marginTop: 6 }}>
                <StatusBadge status={result.integrity_status} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {integrityLabel(result.integrity_status)}
              </div>
            </div>

            {(result.sha256_hash || result.sha256_stored) && (
              <div className="card" style={{ padding: 16 }}>
                <div className="label">Сравнение хэшей</div>
                <div className="verify-hashes" style={{ marginTop: 6 }}>
                  {result.sha256_hash && (
                    <div>
                      <span className="muted">Переданный / вычисленный:</span>{" "}
                      <code>{result.sha256_hash}</code>
                    </div>
                  )}
                  {result.sha256_stored && (
                    <div>
                      <span className="muted">В реестре:</span> <code>{result.sha256_stored}</code>
                    </div>
                  )}
                  {result.sha256_hash && result.sha256_stored && (
                    <div style={{ marginTop: 8 }}>
                      {result.sha256_hash === result.sha256_stored ? (
                        <span className="ok">Хэши совпадают</span>
                      ) : (
                        <span className="bad">Хэши не совпадают</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 16 }}>
              <div className="label">Документ</div>
              <div className="verify-hashes" style={{ marginTop: 6 }}>
                {result.file_name && (
                  <div>
                    <span className="muted">Имя файла:</span> {result.file_name}
                  </div>
                )}
                {result.description && (
                  <div>
                    <span className="muted">Описание:</span> {result.description}
                  </div>
                )}
                {result.digital_object_id && (
                  <div>
                    <span className="muted">ID в системе:</span> <code>{result.digital_object_id}</code>
                  </div>
                )}
                {result.owner_id && (
                  <div>
                    <span className="muted">Учётная запись владельца:</span> <code>{result.owner_id}</code>
                  </div>
                )}
                {result.registered_at && (
                  <div>
                    <span className="muted">Дата загрузки:</span> {new Date(result.registered_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="label">Блокчейн</div>
              {result.transaction_hash ? (
                <div className="verify-hashes" style={{ marginTop: 6 }}>
                  <div>
                    <span className="muted">Транзакция:</span> <code>{result.transaction_hash}</code>
                  </div>
                  <div className="row" style={{ marginTop: 6, gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigator.clipboard.writeText(result.transaction_hash || "")}
                    >
                      Копировать хэш транзакции
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`https://example.local/tx/${result.transaction_hash}`, "_blank")}
                    >
                      Обозреватель блокчейна
                    </button>
                  </div>
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  On-chain транзакции пока нет — документ может быть только в off-chain реестре.
                </div>
              )}
            </div>
          </div>

          <div className="row no-print" style={{ marginTop: 16, gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                const text = JSON.stringify(
                  {
                    used_hash: hash || "(вычислен из файла)",
                    ...result,
                  },
                  null,
                  2
                );
                void navigator.clipboard.writeText(text);
              }}
            >
              Копировать отчёт
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
              Печать
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
