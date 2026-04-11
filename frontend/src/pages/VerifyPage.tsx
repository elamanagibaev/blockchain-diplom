import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { FileUp, Hash } from "lucide-react";
import { api } from "../api/client";
import { StageTimeline } from "../components/StageTimeline";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
type VerificationResult = {
  verification_status: string;
  is_verified: boolean;
  digital_object_id: string | null;
  registered_at: string | null;
  registration_timestamp?: string | null;
  owner_id: string | null;
  owner_email?: string | null;
  file_name: string | null;
  description: string | null;
  transaction_hash: string | null;
  integrity_status: string;
  sha256_hash?: string | null;
  sha256_stored?: string | null;
  blockchain_registered_at?: string | null;
  status?: string | null;
  processing_stage?: number | null;
  stage_history?: Record<string, unknown>[] | null;
  chain_events?: { action_type: string; timestamp?: string | null; tx_hash?: string | null }[];
  department_approved_at?: string | null;
  deanery_approved_at?: string | null;
  student_wallet_address?: string | null;
};

function proofBannerMeta(vs: string): { title: string; sub: string; ok: boolean | null } {
  if (vs === "VALID") {
    return {
      ok: true,
      title: "✓ Документ подлинный",
      sub: "Хэш совпадает с записью в блокчейне.",
    };
  }
  if (vs === "NOT_FOUND") {
    return {
      ok: false,
      title: "? Документ не найден",
      sub: "Такого SHA-256 нет среди зарегистрированных объектов.",
    };
  }
  if (vs === "INVALID") {
    return {
      ok: false,
      title: "✗ Документ изменён или не подтверждён в реестре",
      sub: "Хэш известен системе, но нет полной on-chain регистрации.",
    };
  }
  if (vs === "INVALID_HASH") {
    return {
      ok: false,
      title: "✗ Неверный формат SHA-256",
      sub: "Ожидается 64 шестнадцатеричных символа.",
    };
  }
  return { ok: null, title: vs, sub: "" };
}

export const VerifyPage: React.FC = () => {
  const [tab, setTab] = useState<"file" | "hash">("file");
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (tab === "file" && !file) {
      setError("Выберите файл");
      return;
    }
    if (tab === "hash" && !hash.trim()) {
      setError("Введите SHA-256");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (tab === "hash") {
        res = await api.get<VerificationResult>(`/verify/hash/${encodeURIComponent(hash.trim())}`);
      } else {
        const form = new FormData();
        if (file) form.append("upload_file", file);
        res = await api.post<VerificationResult>("/verify/file", form);
      }
      setResult(res.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail || "Ошибка проверки";
      setError(typeof msg === "string" ? msg : "Ошибка проверки");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setTab("file");
    }
  }, []);

  const meta = result ? proofBannerMeta(result.verification_status) : null;

  return (
    <div>
      <h1 className="page-title">Верификация документа</h1>
      <p className="page-subtitle">Проверка по содержимому файла (SHA-256) или по известному хэшу.</p>

      <Card>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "file" ? "tab--active" : ""}`}
            onClick={() => {
              setTab("file");
              setError(null);
            }}
          >
            <FileUp size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Загрузить файл
          </button>
          <button
            type="button"
            className={`tab ${tab === "hash" ? "tab--active" : ""}`}
            onClick={() => {
              setTab("hash");
              setError(null);
            }}
          >
            <Hash size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            По хэшу
          </button>
        </div>

        <form onSubmit={submit} className="stack">
          {tab === "file" ? (
            <div
              className={`drop-zone ${drag ? "drop-zone--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("verify-file-input")?.click()}
              role="button"
              tabIndex={0}
            >
              <FileUp size={40} strokeWidth={1.25} style={{ margin: "0 auto 12px", color: "var(--accent)" }} />
              <div style={{ fontWeight: 600 }}>Перетащите файл для проверки</div>
              <div className="muted" style={{ fontSize: 13 }}>
                или нажмите для выбора
              </div>
              <input
                id="verify-file-input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          ) : (
            <Input
              label="SHA-256 (64 символа)"
              name="hash"
              value={hash}
              onChange={(e) => setHash(e.target.value.trim())}
              placeholder="Полный хэш"
              autoComplete="off"
            />
          )}

          {file && tab === "file" && (
            <div className="muted" style={{ fontSize: 13 }}>
              Файл: <strong>{file.name}</strong>
            </div>
          )}

          {error && <div className="bad">{error}</div>}

          <Button type="submit" variant="primary" loading={loading} disabled={loading}>
            Проверить документ
          </Button>
          <p className="muted" style={{ fontSize: 12 }}>
            Имя файла не используется — только хэш содержимого.
          </p>
        </form>
      </Card>

      {result && meta && (
        <div style={{ marginTop: 24 }}>
          <div
            className={`proof-banner ${
              meta.ok === true ? "proof-banner--ok" : meta.ok === false ? "proof-banner--bad" : "proof-banner--neutral"
            }`}
          >
            <div className="proof-banner-icon" aria-hidden>
              {meta.ok === true ? "✓" : meta.ok === false ? "✕" : "•"}
            </div>
            <div>
              <div className="proof-banner-title">{meta.title}</div>
              {meta.sub && <div className="proof-banner-sub">{meta.sub}</div>}
            </div>
          </div>

          <Card style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Хэш
                </div>
                {result.sha256_hash && (
                  <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                    <span className="muted">Вычисленный:</span> <code>{result.sha256_hash}</code>
                  </div>
                )}
                {result.sha256_stored && (
                  <div style={{ fontSize: 12, wordBreak: "break-all", marginTop: 6 }}>
                    <span className="muted">В реестре:</span> <code>{result.sha256_stored}</code>
                  </div>
                )}
              </div>
              <div style={{ flex: "1 1 240px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Документ
                </div>
                <div style={{ fontSize: 14, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  {result.file_name && <div>Файл: {result.file_name}</div>}
                  {result.digital_object_id && (
                    <div>
                      ID: <code>{result.digital_object_id}</code>
                    </div>
                  )}
                  {result.owner_email && <div>Владелец: {result.owner_email}</div>}
                  {result.status && <div>Статус: {result.status}</div>}
                </div>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Блокчейн
                </div>
                {result.transaction_hash ? (
                  <code style={{ fontSize: 12, wordBreak: "break-all" }}>{result.transaction_hash}</code>
                ) : (
                  <span className="muted">Нет on-chain транзакции</span>
                )}
              </div>
            </div>

            {result.digital_object_id && result.registered_at && (
              <div style={{ marginTop: 24 }}>
                <StageTimeline
                  status={result.status || "UNKNOWN"}
                  processingStage={result.processing_stage}
                  createdAt={result.registered_at}
                  sha256Hash={result.sha256_stored || result.sha256_hash || ""}
                  departmentApprovedAt={result.department_approved_at}
                  deaneryApprovedAt={result.deanery_approved_at}
                  aiCheckStatus="skipped"
                  blockchainTxHash={result.transaction_hash}
                  studentWalletAddress={result.student_wallet_address}
                  compact
                />
              </div>
            )}

            {result.chain_events && result.chain_events.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>События (журнал)</div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Тип</th>
                        <th>Время</th>
                        <th>Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.chain_events.map((ev, i) => (
                        <tr key={i}>
                          <td>{ev.action_type}</td>
                          <td>{ev.timestamp ? new Date(ev.timestamp).toLocaleString("ru-RU") : "—"}</td>
                          <td>
                            <code style={{ fontSize: 11 }}>{ev.tx_hash ? `${ev.tx_hash.slice(0, 14)}…` : "—"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.verification_status === "VALID" && result.digital_object_id && (
              <div className="row" style={{ marginTop: 24, gap: 24, flexWrap: "wrap" }}>
                <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <QRCode
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/doc/${result.digital_object_id}`}
                    size={140}
                    level="M"
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Публичная проверка</div>
                  <p className="muted" style={{ fontSize: 13 }}>
                    QR ведёт на страницу документа по ID.
                  </p>
                  <Link to={`/verify/doc/${result.digital_object_id}`} style={{ display: "inline-block", marginTop: 8 }}>
                    Открыть карточку
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
