import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, Table2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { api } from "../api/client";

type Metrics = {
  total: number;
  on_chain: number;
  verified: number;
  invalid: number;
};

type University = { id: number; name: string; short_name: string | null };

type AdminFileRow = FileRow & {
  owner_email?: string | null;
  uploaded_by_email?: string | null;
};

function truncateFileName(name: string, max = 30): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}…`;
}

function formatTxShort(hash: string | null | undefined): string {
  if (!hash || hash.length < 10) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function relativeTime(dateStr: string): string {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return `${Math.floor(diff / 86_400_000)} дн назад`;
}

function statusTxBadge(status: string, hasTx: boolean): { label: string; bg: string; color: string } {
  if (status === "REGISTERED_ON_CHAIN" || status === "ASSIGNED_TO_OWNER" || (hasTx && status === "REGISTERED")) {
    return { label: "В блокчейне", bg: "rgba(22, 163, 74, 0.15)", color: "#0d9488" };
  }
  if (status === "DEAN_APPROVED") {
    return { label: "Одобрен деканатом", bg: "rgba(217, 119, 6, 0.15)", color: "#b45309" };
  }
  if (status === "UNDER_REVIEW") {
    return { label: "На согласовании", bg: "rgba(234, 179, 8, 0.18)", color: "#b45309" };
  }
  if (status === "FROZEN" || status === "UPLOADED") {
    return { label: "Зафиксирован", bg: "rgba(59, 130, 246, 0.15)", color: "#2563eb" };
  }
  if (status === "REJECTED") {
    return { label: "Отклонён", bg: "rgba(220, 38, 38, 0.12)", color: "#dc2626" };
  }
  return { label: status, bg: "var(--color-border-tertiary, var(--color-border))", color: "var(--color-text-secondary, var(--color-muted))" };
}

function isStartOfTodayLocal(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function countDocsForUniversity(files: AdminFileRow[], u: University): number {
  return files.filter((f) => docMatchesUniversity(f.uploaded_by_email, u)).length;
}

function docMatchesUniversity(email: string | null | undefined, u: University): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1] || "";
  const parts = [u.short_name, u.name].filter(Boolean) as string[];
  for (const raw of parts) {
    const t = raw.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
    if (t.length < 2) continue;
    if (domain.includes(t) || lower.includes(t)) return true;
  }
  return false;
}

const metricCardBase: React.CSSProperties = {
  background: "var(--color-background-primary, var(--color-surface-elevated, hsl(var(--card))))",
  border: "0.5px solid var(--color-border-tertiary, var(--color-border))",
  borderRadius: "var(--border-radius-lg, var(--radius-lg, 8px))",
  padding: "12px 14px",
  minWidth: 0,
};

const cellEllipsis: React.CSSProperties = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [files, setFiles] = useState<AdminFileRow[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [pendingOnChain, setPendingOnChain] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const admin = user?.role === "admin";
    const settled = await Promise.allSettled([
      api.get<Metrics>("/files/metrics"),
      api.get<AdminFileRow[]>("/files"),
      admin ? api.get<University[]>("/admin/universities") : Promise.resolve({ data: [] as University[] }),
      admin ? api.get<unknown[]>("/admin/documents/pending") : Promise.resolve({ data: [] as unknown[] }),
    ]);

    if (settled[0].status === "fulfilled") {
      setMetrics(settled[0].value.data);
    } else {
      setMetrics({ total: 0, on_chain: 0, verified: 0, invalid: 0 });
    }

    if (settled[1].status === "fulfilled" && Array.isArray(settled[1].value.data)) {
      setFiles(settled[1].value.data);
    } else {
      setFiles([]);
    }

    if (admin) {
      if (settled[2].status === "fulfilled" && Array.isArray(settled[2].value.data)) {
        setUniversities(settled[2].value.data);
      } else {
        setUniversities([]);
      }
      if (settled[3].status === "fulfilled" && Array.isArray(settled[3].value.data)) {
        setPendingOnChain(settled[3].value.data);
      } else {
        setPendingOnChain([]);
      }
    } else {
      setUniversities([]);
      setPendingOnChain([]);
    }

    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [files]
  );

  const recentMine = useMemo(() => sortedFiles.slice(0, 8), [sortedFiles]);

  const adminStats = useMemo(() => {
    if (!isAdmin) return null;
    const underReview = files.filter((f) => f.status === "UNDER_REVIEW");
    const atDean = underReview.filter((f) => f.current_approval_stage_code === "DEAN_REVIEW").length;
    const atDept = underReview.length - atDean;
    const rejected = files.filter((f) => f.status === "REJECTED").length;
    const onChainStatuses = new Set(["REGISTERED_ON_CHAIN", "ASSIGNED_TO_OWNER"]);
    const inBlockchain = files.filter((f) => onChainStatuses.has(f.status) || (f.status === "REGISTERED" && f.blockchain_tx_hash)).length;
    const frozenUploaded = files.filter((f) => f.status === "FROZEN" || f.status === "UPLOADED").length;
    const underDeptStage = underReview.filter(
      (f) => f.current_approval_stage_code !== "DEAN_REVIEW"
    ).length;
    const underDeanStage = atDean;
    const verifiedToday = files.filter(
      (f) => f.status === "REGISTERED_ON_CHAIN" && isStartOfTodayLocal(f.created_at)
    ).length;
    return {
      underReviewCount: underReview.length,
      atDean,
      atDept,
      rejected,
      inBlockchain,
      frozenUploaded,
      underDeptStage,
      underDeanStage,
      verifiedToday,
    };
  }, [files, isAdmin]);

  const topTxRows = useMemo(() => sortedFiles.slice(0, 6), [sortedFiles]);

  const uniCounts = useMemo(() => {
    if (!isAdmin) return [];
    return universities.map((u) => ({ u, count: countDocsForUniversity(files, u) }));
  }, [isAdmin, universities, files]);

  const maxUniCount = useMemo(() => Math.max(1, ...uniCounts.map((x) => x.count)), [uniCounts]);

  const pctOnChain =
    metrics && metrics.total > 0 ? Math.round((metrics.on_chain / metrics.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Spinner size={40} />
        <span className="text-sm" style={{ color: "var(--color-text-secondary, var(--color-muted))" }}>
          Загрузка…
        </span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Панель" subtitle="Сводка по вашим документам" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={metricCardBase}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-text-secondary, var(--color-muted))",
                marginBottom: 6,
              }}
            >
              Мои документы
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--color-text-primary, var(--color-text))",
              }}
            >
              {metrics?.total ?? 0}
            </div>
          </div>
          <div style={metricCardBase}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-text-secondary, var(--color-muted))",
                marginBottom: 6,
              }}
            >
              В блокчейне
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#0d9488" }}>{metrics?.on_chain ?? 0}</div>
          </div>
        </div>

        <div
          style={{
            ...metricCardBase,
            border: "0.5px solid var(--color-border-tertiary, var(--color-border))",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary, var(--color-text))" }}>
              Недавние документы
            </h2>
            <Link to="/files" className="muted" style={{ fontSize: 14 }}>
              Все документы →
            </Link>
          </div>
          {recentMine.length ? (
            <div className="data-table-wrap">
              <FileTable items={recentMine} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden>
                📄
              </div>
              <div style={{ fontWeight: 600 }}>Документов пока нет</div>
              {user?.role === "department" && (
                <Link to="/upload" style={{ display: "inline-block", marginTop: 12 }}>
                  Загрузить диплом
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const st = adminStats!;

  return (
    <div>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            className="page-title"
            style={{ marginBottom: 4, color: "var(--color-text-primary, var(--color-text))" }}
          >
            Панель администратора
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Мониторинг блокчейна и документооборота
          </p>
        </div>
        <span
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 9999,
            background: "#0d9488",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Только администратор
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
        className="admin-dash-metrics-grid"
      >
        <div style={metricCardBase}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-secondary, var(--color-muted))",
            }}
          >
            Всего документов
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              marginTop: 6,
              color: "var(--color-text-primary, var(--color-text))",
            }}
          >
            {metrics?.total ?? 0}
          </div>
        </div>
        <div style={metricCardBase}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-secondary, var(--color-muted))",
            }}
          >
            В блокчейне
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 6, color: "#0d9488" }}>
            {metrics?.on_chain ?? 0}
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#0d9488" }}>{pctOnChain}% от всех</div>
        </div>
        <div style={metricCardBase}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-secondary, var(--color-muted))",
            }}
          >
            На согласовании
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 6, color: "#b45309" }}>
            {st.underReviewCount}
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#b45309" }}>
            {st.atDean > 0 || st.atDept > 0
              ? `${st.atDean} у деканата · ${st.atDept} у кафедры`
              : `${st.underReviewCount} всего`}
          </div>
        </div>
        <div style={metricCardBase}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-secondary, var(--color-muted))",
            }}
          >
            Отклонено всего
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 6, color: "#dc2626" }}>{st.rejected}</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .admin-dash-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .admin-dash-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .admin-dash-metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div
        className="admin-dash-two-col"
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1.4fr",
          gap: 16,
          marginBottom: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            ...metricCardBase,
            overflow: "hidden",
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--color-text-primary, var(--color-text))",
            }}
          >
            Последние транзакции блокчейна
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Хэш транзакции</th>
                  <th style={{ width: "38%" }}>Документ</th>
                  <th style={{ width: "22%" }}>Статус</th>
                  <th style={{ width: "18%" }}>Время</th>
                </tr>
              </thead>
              <tbody>
                {topTxRows.map((row) => {
                  const hasTx = Boolean(row.blockchain_tx_hash);
                  const badge = statusTxBadge(row.status, hasTx);
                  return (
                    <tr key={row.id}>
                      <td style={{ ...cellEllipsis, fontFamily: "monospace", fontSize: 12 }}>
                        {formatTxShort(row.blockchain_tx_hash)}
                      </td>
                      <td style={cellEllipsis} title={row.file_name}>
                        <Link to={`/files/${row.id}`}>{truncateFileName(row.file_name)}</Link>
                      </td>
                      <td style={cellEllipsis}>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ ...cellEllipsis, fontSize: 12, color: "var(--color-text-secondary, var(--color-muted))" }}>
                        {relativeTime(row.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ ...metricCardBase, overflow: "hidden" }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--color-text-primary, var(--color-text))",
              }}
            >
              По университетам
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {uniCounts.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Нет данных справочника
                </div>
              ) : (
                uniCounts.map(({ u, count }) => (
                  <div key={u.id} className="row" style={{ alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 70,
                        flexShrink: 0,
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "var(--color-text-primary, var(--color-text))",
                      }}
                      title={u.name}
                    >
                      {u.short_name || u.name}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, height: 8, background: "var(--color-border-tertiary, var(--color-border))", borderRadius: 4 }}>
                      <div
                        style={{
                          width: `${(count / maxUniCount) * 100}%`,
                          height: "100%",
                          borderRadius: 4,
                          background: "#0d9488",
                          minWidth: count > 0 ? 4 : 0,
                        }}
                      />
                    </div>
                    <div style={{ width: 28, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 600 }}>{count}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ ...metricCardBase, overflow: "hidden" }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--color-text-primary, var(--color-text))",
              }}
            >
              Статус обработки
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
              <li className="row" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ color: "#0d9488" }}>🟢</span>
                <span style={{ flex: 1, color: "var(--color-text-primary, var(--color-text))" }}>В блокчейне</span>
                <strong>{st.inBlockchain}</strong>
              </li>
              <li className="row" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ color: "#6b7280" }}>⚫</span>
                <span style={{ flex: 1, color: "var(--color-text-primary, var(--color-text))" }}>Зафиксированы</span>
                <strong>{st.frozenUploaded}</strong>
              </li>
              <li className="row" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ color: "#3b82f6" }}>🔵</span>
                <span style={{ flex: 1, color: "var(--color-text-primary, var(--color-text))" }}>У кафедры</span>
                <strong>{st.underDeptStage}</strong>
              </li>
              <li className="row" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ color: "#d97706" }}>🟡</span>
                <span style={{ flex: 1, color: "var(--color-text-primary, var(--color-text))" }}>У деканата</span>
                <strong>{st.underDeanStage}</strong>
              </li>
              <li className="row" style={{ gap: 8, alignItems: "center" }}>
                <span style={{ color: "#dc2626" }}>🔴</span>
                <span style={{ flex: 1, color: "var(--color-text-primary, var(--color-text))" }}>Отклонено</span>
                <strong>{st.rejected}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
        className="admin-dash-bottom-grid"
      >
        <div
          className="row"
          style={{
            ...metricCardBase,
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#d1fae5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Check size={20} color="#065f46" aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary, var(--color-muted))",
                marginBottom: 4,
              }}
            >
              Верифицировано сегодня
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary, var(--color-text))" }}>
              {st.verifiedToday}
            </div>
          </div>
        </div>
        <div
          className="row"
          style={{
            ...metricCardBase,
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Table2 size={20} color="#1e40af" aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary, var(--color-muted))",
                marginBottom: 4,
              }}
            >
              Активных университетов
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary, var(--color-text))" }}>
              {universities.length}
            </div>
          </div>
        </div>
        <div
          className="row"
          style={{
            ...metricCardBase,
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#fef3c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertCircle size={20} color="#92400e" aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary, var(--color-muted))",
                marginBottom: 4,
              }}
            >
              Ожидают on-chain
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary, var(--color-text))" }}>
              {pendingOnChain.length}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .admin-dash-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="row" style={{ marginTop: 20, gap: 12 }}>
        <Link to="/admin" className="ui-btn ui-btn--primary ui-btn--md" style={{ textDecoration: "none" }}>
          Админ-панель
        </Link>
        <Link to="/verify" className="ui-btn ui-btn--secondary ui-btn--md" style={{ textDecoration: "none" }}>
          Верификация
        </Link>
      </div>
    </div>
  );
};
