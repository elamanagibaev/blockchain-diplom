import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Blocks, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { BRAND_NAME } from "../constants/brand";

type VerifyResponse = {
  is_verified?: boolean;
  verification_status?: string;
  file_name?: string | null;
  blockchain_registered_at?: string | null;
  registration_timestamp?: string | null;
};

function formatRegisteredAt(data: VerifyResponse): string | null {
  const raw = data.blockchain_registered_at || data.registration_timestamp;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleString("ru-RU", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return raw;
  }
}

export const LandingPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [verifyTab, setVerifyTab] = useState<"file" | "hash">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hashValue, setHashValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setSelectedFile(file);
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setHashValue(computedHash);
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const hash = hashValue.trim();
    if (!hash) return;
    setLoading(true);
    setNetworkError(false);
    setResult(null);
    try {
      const { data } = await api.get<VerifyResponse>(`/verify/hash/${encodeURIComponent(hash)}`);
      setResult(data);
    } catch (err: unknown) {
      const ax = err as { response?: unknown; message?: string };
      if (!ax?.response) {
        setNetworkError(true);
      } else {
        setResult({ verification_status: "NOT_FOUND", is_verified: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const isAuthentic =
    result?.verification_status === "VALID" && result.is_verified === true;
  const isMissing =
    result &&
    !isAuthentic &&
    (result.verification_status === "NOT_FOUND" ||
      result.verification_status === "INVALID" ||
      result.verification_status === "INVALID_HASH");

  return (
    <div className="min-h-screen bg-background bg-grid-pattern text-foreground">
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:px-8"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
      >
        <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Blocks className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          {authLoading ? (
            <span className="text-sm text-muted-foreground">…</span>
          ) : user ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-accent, #0d9488)" }}
            >
              Перейти в панель
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-accent, #0d9488)" }}
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-20 pt-28 md:pt-32">
        <section className="mb-12 text-center md:mb-16">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Верификация дипломов на блокчейне
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Проверьте подлинность документа по его хэшу — без регистрации
          </p>
        </section>

        <section className="mx-auto mb-20 max-w-lg">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated md:p-8">
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setVerifyTab("file")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: verifyTab === "file" ? "#0d9488" : "#e5e7eb",
                  color: verifyTab === "file" ? "white" : "#374151",
                  fontWeight: 600,
                }}
              >
                📄 По файлу
              </button>
              <button
                type="button"
                onClick={() => setVerifyTab("hash")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: verifyTab === "hash" ? "#0d9488" : "#e5e7eb",
                  color: verifyTab === "hash" ? "white" : "#374151",
                  fontWeight: 600,
                }}
              >
                🔑 По хэшу
              </button>
            </div>
            <form onSubmit={onVerify} className="flex flex-col gap-4">
              {verifyTab === "file" ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void handleFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #0d9488",
                      borderRadius: 8,
                      padding: "40px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "#f0fdf4",
                      marginBottom: 12,
                    }}
                  >
                    {selectedFile ? selectedFile.name : "Перетащите файл или нажмите для выбора"}
                  </div>
                </>
              ) : (
                <>
                  <label className="sr-only" htmlFor="landing-hash-input">
                    SHA-256 хэш документа
                  </label>
                  <input
                    id="landing-hash-input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Введите SHA-256 хэш документа"
                    value={hashValue}
                    onChange={(e) => setHashValue(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </>
              )}
              <button
                type="submit"
                disabled={loading || !hashValue.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent, #0d9488)" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Проверка…
                  </>
                ) : (
                  "Проверить"
                )}
              </button>
            </form>

            {networkError && (
              <div
                className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                Ошибка соединения с сервером
              </div>
            )}

            {isAuthentic && result && (
              <div
                className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
                role="status"
              >
                <p className="font-semibold">✓ Документ подлинный</p>
                {result.file_name && (
                  <p className="mt-2 text-foreground/90">
                    <span className="text-muted-foreground">Документ: </span>
                    {result.file_name}
                  </p>
                )}
                {formatRegisteredAt(result) && (
                  <p className="mt-1 text-foreground/90">
                    <span className="text-muted-foreground">Дата регистрации в блокчейне: </span>
                    {formatRegisteredAt(result)}
                  </p>
                )}
              </div>
            )}

            {isMissing && !networkError && (
              <div
                className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="status"
              >
                ✗ Документ не найден в реестре
              </div>
            )}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-center text-xl font-semibold text-foreground">Как это работает</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/80 p-6 shadow-sm">
              <div className="mb-2 text-2xl" aria-hidden>
                🎓
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Кафедра загружает</h3>
              <p className="text-sm text-muted-foreground">Диплом загружается и фиксируется в системе</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-6 shadow-sm">
              <div className="mb-2 text-2xl" aria-hidden>
                ✅
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Деканат подтверждает</h3>
              <p className="text-sm text-muted-foreground">Документ проходит проверку и согласование</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-6 shadow-sm">
              <div className="mb-2 text-2xl" aria-hidden>
                🔗
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Блокчейн хранит</h3>
              <p className="text-sm text-muted-foreground">
                Хэш документа записывается в смарт-контракт навсегда
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        {BRAND_NAME} © 2025 — Защищённая платформа верификации документов
      </footer>
    </div>
  );
};
