import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { BRAND_NAME } from "../constants/brand";
import { getExplorerTxUrlOptional } from "../utils/blockExplorer";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, "");

type PublicVerify = {
  document_id: string;
  status: string;
  owner_email?: string | null;
  owner_wallet_address?: string | null;
  registration_timestamp?: string | null;
  sha256_hash?: string | null;
  hash_short?: string | null;
  verify_url: string;
  is_authentic: boolean;
  tx_hash?: string | null;
  tx_explorer_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  file_preview_url?: string | null;
};

function statusRu(status?: string | null): string {
  const raw = (status || "").toUpperCase();
  const map: Record<string, string> = {
    ASSIGNED_TO_OWNER: "Закреплён за выпускником",
    REGISTERED_ON_CHAIN: "Зарегистрирован в блокчейне",
    REGISTERED: "Зарегистрирован",
    DEAN_APPROVED: "Подтверждён деканатом",
    APPROVED: "Подтверждён",
    UNDER_REVIEW: "Ожидает подтверждения",
    REJECTED: "Документ отклонён",
  };
  return map[raw] || status || "—";
}

function toPublicApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase.replace(/\/+$/, "");
  if (path.startsWith("/api/")) {
    const baseNoApi = base.endsWith("/api") ? base.slice(0, -4) : base;
    return `${baseNoApi}${path}`;
  }
  if (path.startsWith("/")) {
    const baseWithApi = base.endsWith("/api") ? base : `${base}/api`;
    return `${baseWithApi}${path}`;
  }
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export const VerifyDocPage: React.FC = () => {
  const { docId } = useParams();
  const [data, setData] = useState<PublicVerify | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    void fetch(`${apiBase}/verify/${docId}`)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.json().catch(() => ({}));
          throw new Error((t as { detail?: string }).detail || r.statusText);
        }
        return r.json() as Promise<PublicVerify>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [docId]);

  const previewUrl = useMemo(() => {
    if (!data?.file_preview_url) return "";
    return toPublicApiUrl(data.file_preview_url);
  }, [data?.file_preview_url]);

  const txUrl = useMemo(() => {
    const direct = (data?.tx_explorer_url || "").trim();
    if (direct) return direct;
    return getExplorerTxUrlOptional((data?.tx_hash || "").trim());
  }, [data?.tx_explorer_url, data?.tx_hash]);

  const copyId = async () => {
    if (!data?.document_id) return;
    try {
      await navigator.clipboard.writeText(data.document_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>Загрузка данных документа...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
        <h1>Документ не найден</h1>
        <p style={{ color: "#475569" }}>Проверьте ссылку или выполните полную проверку файла.</p>
        <Link to="/verify" className="btn btn-primary">Перейти к полной проверке</Link>
      </div>
    );
  }

  const statusBadges = [
    data.status ? "Документ зарегистрирован" : "Данные не найдены",
    data.is_authentic ? "Запись подтверждена в блокчейне" : "Запись в блокчейне не подтверждена",
  ];

  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    background: "#f8fafc",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 10px",
    wordBreak: "break-all",
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <main style={{ maxWidth: 1120, margin: "28px auto", padding: "0 16px" }}>
        <section style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 14, padding: 20, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
          <h1 style={{ margin: 0 }}>Публичная проверка документа</h1>
          <p style={{ color: "#475569", marginTop: 8 }}>
            Страница содержит публичные сведения о документе, зарегистрированном в системе и связанном с записью в блокчейне.
          </p>
          <p style={{ marginTop: 8, padding: 10, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#1e3a8a" }}>
            QR-код подтверждает наличие документа в реестре системы. Для полной проверки подлинности необходимо загрузить исходный файл: система рассчитает SHA-256 и сравнит его с зарегистрированным значением.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {statusBadges.map((b) => <span key={b} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "4px 10px", fontSize: 13 }}>{b}</span>)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <Link to="/verify" className="btn btn-primary">Проверить файл полностью</Link>
            {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Открыть файл</a>}
            <button type="button" className="btn btn-outline" onClick={copyId}>Скопировать ID документа</button>
            {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Открыть транзакцию</a>}
            {copied && <span style={{ alignSelf: "center", color: "#166534" }}>Скопировано</span>}
          </div>
        </section>

        <section style={{ display: "grid", gap: 12, marginTop: 14, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
          <article style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 14 }}>
            <h3>Статус документа</h3>
            <p>Статус в системе: <b>{statusRu(data.status)}</b></p>
            <p>Подтверждение в блокчейне: <b>{data.is_authentic ? "Да" : "Нет"}</b></p>
            <p>Дата регистрации / учёта: <b>{data.registration_timestamp ? new Date(data.registration_timestamp).toLocaleString() : "—"}</b></p>
          </article>

          <article style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 14 }}>
            <h3>Владелец</h3>
            <p>Email владельца: <b>{data.owner_email || "—"}</b></p>
            <div style={mono}>{data.owner_wallet_address || "—"}</div>
          </article>

          <article style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 14 }}>
            <h3>Криптографические данные</h3>
            <div style={{ marginBottom: 8 }}><small>SHA-256</small><div style={mono}>{data.sha256_hash || "—"}</div></div>
            <div style={{ marginBottom: 8 }}><small>Краткий хэш</small><div style={mono}>{data.hash_short || "—"}</div></div>
            <div><small>Идентификатор документа</small><div style={mono}>{data.document_id}</div></div>
          </article>

          <article style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 14 }}>
            <h3>Файл документа</h3>
            {previewUrl ? (
              <>
                <p>Название: <b>{data.file_name || "—"}</b></p>
                <p>Тип: <b>{data.mime_type || "—"}</b></p>
                <p>Размер: <b>{typeof data.size_bytes === "number" ? `${data.size_bytes} байт` : "—"}</b></p>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Открыть файл</a>
                <p style={{ color: "#475569", marginTop: 8 }}>Предварительный просмотр помогает ознакомиться с документом, но не заменяет полную проверку подлинности по SHA-256.</p>
              </>
            ) : (
              <>
                <p>Файл недоступен для публичного просмотра.</p>
                <p style={{ color: "#475569" }}>Для полной проверки загрузите исходный файл на странице верификации.</p>
                <Link to="/verify" className="btn btn-outline">Перейти к полной проверке</Link>
              </>
            )}
          </article>

          <article style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 14, gridColumn: "1 / -1" }}>
            <h3>Запись в блокчейне</h3>
            {data.tx_hash ? (
              <>
                <div style={mono}>{data.tx_hash}</div>
                {txUrl ? <a style={{ marginTop: 8, display: "inline-flex" }} href={txUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Открыть транзакцию в обозревателе</a> : <p style={{ color: "#475569" }}>Ссылка на обозреватель недоступна.</p>}
              </>
            ) : (
              <p style={{ color: "#475569" }}>Хэш транзакции недоступен в публичных данных.</p>
            )}
          </article>
        </section>
      </main>
      <footer style={{ textAlign: "center", color: "#64748b", padding: "16px 12px 28px" }}>
        BlockProof · Платформа верификации документов на основе блокчейна
      </footer>
      <Footer />
    </div>
  );
};
