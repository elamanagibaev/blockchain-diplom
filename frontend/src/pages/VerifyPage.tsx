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
      setError("Выберите файл или введите SHA-256 хэш");
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
        return "Хэш совпадает с записью в блокчейне / базе данных.";
      case "NOT_FOUND":
        return "Документ с таким хэшем не зарегистрирован в системе.";
      case "INVALID_HASH":
        return "Некорректный формат SHA-256 хэша.";
      default:
        return "Служебный статус проверки целостности.";
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Проверка подлинности медицинского документа"
        subtitle="Загрузите файл или введите его SHA-256 хэш, чтобы получить криптографическое доказательство целостности."
      />

      <div className="verify-layout">
        <div className="card">
          <div className="badge badge-soft-blue badge-pill" style={{ marginBottom: 10 }}>
            Central feature · Verification
          </div>
          <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
            <div>
              <div className="label">Файл для проверки</div>
              <input
                className="input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div style={{ textAlign: "center", margin: "4px 0", fontSize: 12 }} className="muted">
              или введите известный SHA-256 хэш
            </div>
            <div>
              <div className="label">SHA-256 хэш документа</div>
              <input
                className="input"
                value={hash}
                onChange={(e) => setHash(e.target.value.trim())}
                placeholder="64-значный SHA-256 хэш"
              />
            </div>
            {error && <div className="bad">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size={16} /> Проверка...
                </>
              ) : (
                "Проверить подлинность"
              )}
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Система не отправляет файл в блокчейн: для проверки используется только вычисленный хэш, который
              сравнивается с уже зарегистрированными объектами.
            </div>
          </form>
        </div>

        <div className="card">
          <div className="label">Как работает верификация</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            1. Для загруженного файла вычисляется SHA-256 хэш. <br />
            2. Хэш сравнивается с записями в базе данных и, при наличии, с объектами в блокчейн-реестре{" "}
            <code>FileRegistry</code>. <br />
            3. Система возвращает статус целостности и, при успехе, привязывает документ к блокчейн-транзакции.
          </div>
          <ul className="page-sidebar-list" style={{ marginTop: 10 }}>
            <li>
              <span className="page-sidebar-dot" />
              On-chain хранятся только хэши, идентификатор объекта и владелец — без медицинского содержимого.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              Любое изменение файла меняет его SHA-256 хэш, и верификация покажет несоответствие.
            </li>
            <li>
              <span className="page-sidebar-dot" />
              Отчёт о проверке можно скопировать или распечатать и приложить к медицинской документации.
            </li>
          </ul>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="label">Результат криптографической проверки</div>
              <div className="muted">
                {result.is_verified ? "Документ подтверждён системой BlockProof." : "Документ не найден или хэш не соответствует зарегистрированным данным."}
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <StatusBadge status={result.is_verified ? "VERIFIED" : "NOT_VERIFIED"} />
              {result.is_verified && result.sha256_hash && (
                <Link
                  to={`/verify/hash/${result.sha256_hash}`}
                  className="btn btn-outline btn-sm"
                >
                  Сертификат
                </Link>
              )}
            </div>
          </div>

          <div className="verify-result-grid" style={{ marginTop: 8 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="label">Итоговый статус целостности</div>
              <div style={{ marginTop: 6 }}>
                <StatusBadge status={result.integrity_status} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {integrityLabel(result.integrity_status)}
              </div>
            </div>

            {(result.sha256_hash || result.sha256_stored) && (
              <div className="card" style={{ padding: 16 }}>
                <div className="label">Сравнение хэшей (Hash Comparison)</div>
                <div className="verify-hashes" style={{ marginTop: 6 }}>
                  {result.sha256_hash && (
                    <div>
                      <span className="muted">Вычисленный/переданный хэш:</span>{" "}
                      <code>{result.sha256_hash}</code>
                    </div>
                  )}
                  {result.sha256_stored && (
                    <div>
                      <span className="muted">Хэш в реестре:</span>{" "}
                      <code>{result.sha256_stored}</code>
                    </div>
                  )}
                  {result.sha256_hash && result.sha256_stored && (
                    <div style={{ marginTop: 8 }}>
                      {result.sha256_hash === result.sha256_stored ? (
                        <span className="ok">Хэши совпадают — целостность подтверждена</span>
                      ) : (
                        <span className="bad">Хэши не совпадают</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 16 }}>
              <div className="label">Основные атрибуты документа</div>
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
                    <span className="muted">ID объекта в системе:</span>{" "}
                    <code>{result.digital_object_id}</code>
                  </div>
                )}
                {result.owner_id && (
                  <div>
                    <span className="muted">Владелец (пользователь):</span>{" "}
                    <code>{result.owner_id}</code>
                  </div>
                )}
                {result.registered_at && (
                  <div>
                    <span className="muted">Время регистрации:</span>{" "}
                    {new Date(result.registered_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="label">Blockchain proof (on-chain запись)</div>
              {result.transaction_hash ? (
                <div className="verify-hashes" style={{ marginTop: 6 }}>
                  <div>
                    <span className="muted">Tx hash:</span>{" "}
                    <code>{result.transaction_hash}</code>
                  </div>
                  <div className="row" style={{ marginTop: 6, gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigator.clipboard.writeText(result.transaction_hash || "")}
                    >
                      Скопировать tx hash
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        window.open(
                          `https://example.local/tx/${result.transaction_hash}`,
                          "_blank"
                        )
                      }
                    >
                      Открыть в блокчейн-обозревателе
                    </button>
                  </div>
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  Для этого документа пока нет зафиксированной on-chain транзакции. Он может быть зарегистрирован
                  только в off-chain реестре.
                </div>
              )}
            </div>
          </div>

          <div className="row no-print" style={{ marginTop: 16, gap: 8 }}>
            <button
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
                navigator.clipboard.writeText(text);
              }}
            >
              Скопировать отчёт о проверке
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              Распечатать результат
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

