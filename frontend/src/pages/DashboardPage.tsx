import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, Check, Table2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { FileTable, FileRow } from "../components/FileTable";
import { api } from "../api/client";
import { DASHBOARD_REFRESH_EVENT } from "../lib/dashboardRefresh";

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
  uploaded_by_university_id?: number | null;
  owner_university_id?: number | null;
};

/** Приглушённая палитра в духе sidebar (без неона) */
const AC = {
  teal: "#2f8f89",
  tealDeep: "#2b7a78",
  tealMutedBg: "rgba(47, 143, 137, 0.16)",
  blue: "#4f6b95",
  blueMutedBg: "rgba(79, 107, 149, 0.14)",
  orange: "#b7791f",
  orangeMutedBg: "rgba(183, 121, 31, 0.14)",
  red: "#b85450",
  redMutedBg: "rgba(184, 84, 80, 0.12)",
  gray: "#6b7280",
};

const DASH_MAX = 1440;
const DASH_PAD_X = 28;
const BLOCK_GAP = 22;
const CARD_RADIUS = 12;
const CARD_PAD = "20px 22px";

const cardBase = (): React.CSSProperties => ({
  background: "color-mix(in srgb, var(--surface) 94%, var(--border) 6%)",
  border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
  borderRadius: CARD_RADIUS,
  boxShadow: "var(--shadow), 0 12px 40px -18px rgba(0,0,0,0.35)",
  padding: CARD_PAD,
  minWidth: 0,
});

function truncateFileName(name: string, max = 30): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}…`;
}

function truncateCell(s: string | null | undefined, max: number): string {
  if (!s) return "—";
  const t = s.trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
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
    return { label: "В блокчейне", bg: AC.tealMutedBg, color: AC.tealDeep };
  }
  if (status === "DEAN_APPROVED") {
    return { label: "Одобрен деканатом", bg: AC.orangeMutedBg, color: AC.orange };
  }
  if (status === "UNDER_REVIEW") {
    return { label: "На согласовании", bg: AC.orangeMutedBg, color: AC.orange };
  }
  if (status === "FROZEN" || status === "UPLOADED") {
    return { label: "Зафиксирован", bg: AC.blueMutedBg, color: AC.blue };
  }
  if (status === "REJECTED") {
    return { label: "Отклонён", bg: AC.redMutedBg, color: AC.red };
  }
  return {
    label: status,
    bg: "color-mix(in srgb, var(--border) 40%, var(--surface))",
    color: "var(--text-muted)",
  };
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

function normalizeEmailParts(email: string | null | undefined): { local: string; domain: string; full: string } | null {
  const raw = (email || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return null;
  const at = raw.lastIndexOf("@");
  const local = raw.slice(0, at).trim();
  let domain = raw.slice(at + 1).trim().replace(/^www\./, "");
  if (!domain) return null;
  return { local, domain, full: raw };
}

function emailMatchesUniversity(email: string | null | undefined, u: University): boolean {
  const n = normalizeEmailParts(email);
  if (!n) return false;
  const domainLabels = n.domain.split(".").filter((p) => p.length > 0);
  const domainFlat = domainLabels.join("");

  const tokens = [u.short_name, u.name]
    .filter(Boolean)
    .map((s) => s!.toLowerCase().replace(/[^a-zа-яё0-9]/g, ""))
    .filter((t) => t.length >= 2);

  for (const t of tokens) {
    if (n.domain.includes(t) || n.local.includes(t)) return true;
    if (domainFlat.includes(t)) return true;
    for (const label of domainLabels) {
      if (label.length >= 3 && label.includes(t)) return true;
    }
  }
  return false;
}

function docMatchesUniversity(file: AdminFileRow, u: University): boolean {
  const up = file.uploaded_by_university_id;
  const ow = file.owner_university_id;
  if (up != null && up === u.id) return true;
  if (ow != null && ow === u.id) return true;
  if (emailMatchesUniversity(file.uploaded_by_email, u)) return true;
  if (emailMatchesUniversity(file.owner_email, u)) return true;
  return false;
}

function filesForUniversity(files: AdminFileRow[], u: University): AdminFileRow[] {
  return files.filter((f) => docMatchesUniversity(f, u));
}

/** Блок «По университетам»: в on-chain входят только эти статусы (без черновиков и пайплайна). */
function isDocOnChainForUniversityBlock(f: AdminFileRow): boolean {
  return f.status === "REGISTERED_ON_CHAIN" || f.status === "ASSIGNED_TO_OWNER";
}

function universityLabelForRow(row: AdminFileRow, universities: University[]): string {
  for (const u of universities) {
    if (docMatchesUniversity(row, u)) return u.short_name || u.name;
  }
  return "—";
}

function departmentCell(row: AdminFileRow): string {
  const em = row.uploaded_by_email?.trim();
  if (!em) return "—";
  const local = em.split("@")[0];
  return truncateCell(local, 18);
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        flexShrink: 0,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    />
  );
}

function DashPageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="admin-dash-page-wrap"
      style={{
        width: "100%",
        maxWidth: DASH_MAX,
        margin: "0 auto",
        paddingLeft: DASH_PAD_X,
        paddingRight: DASH_PAD_X,
        boxSizing: "border-box",
      }}
    >
      {children}
      <style>{`
        @media (max-width: 640px) {
          .admin-dash-page-wrap { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [files, setFiles] = useState<AdminFileRow[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [pendingOnChain, setPendingOnChain] = useState<unknown[]>([]);
  /** Первый запрос — полноэкранный спиннер; повторные (возврат на /dashboard, событие) — без блокировки UI */
  const initialBlockingLoadDone = useRef(false);

  const loadDashboardData = useCallback(async () => {
    const blockUi = !initialBlockingLoadDone.current;
    if (blockUi) setLoading(true);
    const admin = user?.role === "admin";
    try {
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
        const list = settled[1].value.data;
        setFiles(list);
        if (import.meta.env.DEV) {
          const statusTally: Record<string, number> = {};
          for (const f of list) {
            statusTally[f.status] = (statusTally[f.status] || 0) + 1;
          }
          const onChainStatuses = new Set(["REGISTERED_ON_CHAIN", "ASSIGNED_TO_OWNER"]);
          const inChain = list.filter(
            (f) => onChainStatuses.has(f.status) || (f.status === "REGISTERED" && f.blockchain_tx_hash)
          ).length;
          const underRev = list.filter((f) => f.status === "UNDER_REVIEW").length;
          console.debug("[dashboard] GET /files", {
            count: list.length,
            statusTally,
            underReview: underRev,
            inBlockchainDerived: inChain,
          });
        }
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
    } finally {
      if (blockUi) {
        initialBlockingLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [user?.role, user?.id]);

  useEffect(() => {
    initialBlockingLoadDone.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (location.pathname !== "/dashboard") return;
    void loadDashboardData();
  }, [location.pathname, loadDashboardData]);

  useEffect(() => {
    const onRefresh = () => void loadDashboardData();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, [loadDashboardData]);

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
    const inBlockchain = files.filter(
      (f) => onChainStatuses.has(f.status) || (f.status === "REGISTERED" && f.blockchain_tx_hash)
    ).length;
    const frozenUploaded = files.filter((f) => f.status === "FROZEN" || f.status === "UPLOADED").length;
    const underDeptStage = underReview.filter((f) => f.current_approval_stage_code !== "DEAN_REVIEW").length;
    const underDeanStage = atDean;
    const verifiedToday = files.filter(
      (f) => f.status === "REGISTERED_ON_CHAIN" && isStartOfTodayLocal(f.created_at)
    ).length;
    const awaitingOnChain = files.filter(
      (f) =>
        (f.status === "DEAN_APPROVED" || f.status === "APPROVED") && !f.blockchain_tx_hash?.trim()
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
      awaitingOnChain,
    };
  }, [files, isAdmin]);

  const topTxRows = useMemo(() => sortedFiles.slice(0, 6), [sortedFiles]);

  const uniCounts = useMemo(() => {
    if (!isAdmin) return [];
    return universities.map((u) => {
      const docs = filesForUniversity(files, u);
      const totalUploadedCount = docs.length;
      const onChainCount = docs.filter(isDocOnChainForUniversityBlock).length;
      const progressPercent =
        totalUploadedCount > 0 ? (onChainCount / totalUploadedCount) * 100 : 0;
      return { u, onChainCount, totalUploadedCount, progressPercent };
    });
  }, [isAdmin, universities, files]);

  const displayTotal = isAdmin ? files.length : (metrics?.total ?? 0);
  const displayOnChain = isAdmin ? (adminStats?.inBlockchain ?? 0) : (metrics?.on_chain ?? 0);
  const pctOnChain =
    displayTotal > 0 ? Math.round((displayOnChain / displayTotal) * 100) : 0;

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 600,
    color: "var(--text-subtle)",
    lineHeight: 1.2,
  };

  const smallUserCard = (): React.CSSProperties => ({
    ...cardBase(),
    padding: "18px 20px",
    boxShadow: "var(--shadow)",
  });

  if (loading) {
    return (
      <DashPageWrap>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" style={{ color: "var(--text-muted)" }}>
          <Spinner size={40} />
          <span className="text-sm">Загрузка…</span>
        </div>
      </DashPageWrap>
    );
  }

  if (!isAdmin) {
    return (
      <DashPageWrap>
        <PageHeader
          title="Панель"
          subtitle="Сводка по вашим документам"
          actions={
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => void loadDashboardData()}>
              Обновить
            </button>
          }
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: BLOCK_GAP,
            marginBottom: BLOCK_GAP,
          }}
        >
          <div style={smallUserCard()}>
            <div style={labelStyle}>Мои документы</div>
            <div style={{ fontSize: 30, fontWeight: 600, marginTop: 10, color: "var(--text)" }}>{displayTotal}</div>
          </div>
          <div style={smallUserCard()}>
            <div style={labelStyle}>В блокчейне</div>
            <div style={{ fontSize: 30, fontWeight: 600, marginTop: 10, color: AC.teal }}>{displayOnChain}</div>
          </div>
        </div>
        <div style={{ ...smallUserCard(), marginBottom: BLOCK_GAP }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Недавние документы</h2>
            <Link to="/files" style={{ fontSize: 13, color: "var(--text-muted)" }}>
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
      </DashPageWrap>
    );
  }

  const st = adminStats!;
  const c = cardBase();

  const metricTile = (opts: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    subColor?: string;
    valueColor?: string;
  }) => (
    <div
      style={{
        ...c,
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "18px 20px 16px",
      }}
    >
      <div style={labelStyle}>{opts.label}</div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          minHeight: 52,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: opts.valueColor ?? "var(--text)",
          }}
        >
          {opts.value}
        </span>
      </div>
      <div style={{ minHeight: 18, fontSize: 12, fontWeight: 500, color: opts.subColor ?? "var(--text-muted)" }}>
        {opts.sub ?? <span style={{ opacity: 0 }}>{"\u00a0"}</span>}
      </div>
    </div>
  );

  return (
    <DashPageWrap>
      <div className="admin-dash-page" style={{ display: "flex", flexDirection: "column", gap: BLOCK_GAP }}>
        <header
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
            paddingBottom: 2,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                color: "var(--text)",
              }}
            >
              Панель администратора
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--text-muted)", fontWeight: 400, maxWidth: 560 }}>
              Мониторинг блокчейна и документооборота
            </p>
          </div>
          <span className="row" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--md" onClick={() => void loadDashboardData()}>
              Обновить
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 16px",
                borderRadius: 9999,
                background: `linear-gradient(180deg, color-mix(in srgb, ${AC.teal} 92%, #fff) 0%, ${AC.tealDeep} 100%)`,
                color: "#f1f5f4",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                boxShadow: `0 1px 0 rgba(255,255,255,0.08) inset, 0 4px 12px -4px rgba(43, 122, 120, 0.35)`,
              }}
            >
              Только администратор
            </span>
          </span>
        </header>

        <section
          className="admin-dash-metrics-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: BLOCK_GAP,
            alignItems: "stretch",
          }}
        >
          {metricTile({
            label: "Всего документов",
            value: displayTotal,
            sub: "В реестре системы",
            valueColor: "var(--text)",
          })}
          {metricTile({
            label: "В блокчейне",
            value: displayOnChain,
            sub: `${pctOnChain}% от всех`,
            subColor: AC.teal,
            valueColor: AC.teal,
          })}
          {metricTile({
            label: "На согласовании",
            value: st.underReviewCount,
            sub:
              st.atDean > 0 || st.atDept > 0
                ? `${st.atDean} у деканата · ${st.atDept} у кафедры`
                : `${st.underReviewCount} всего`,
            subColor: AC.orange,
            valueColor: AC.orange,
          })}
          {metricTile({
            label: "Отклонено всего",
            value: st.rejected,
            sub: "Отклонённые заявки",
            subColor: AC.red,
            valueColor: AC.red,
          })}
        </section>

        <section
          className="admin-dash-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "2.15fr 1fr",
            gap: BLOCK_GAP,
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          <div style={{ ...c, padding: 0, display: "flex", flexDirection: "column", minHeight: 320, minWidth: 0 }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)" }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>
                Последние транзакции блокчейна
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Топ-6 по дате создания</p>
            </div>
            <div className="admin-dash-table-scroll" style={{ flex: 1, overflowX: "auto", minWidth: 0 }}>
              <table
                className="admin-dash-tx-table"
                style={{
                  width: "100%",
                  minWidth: 720,
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width: "13%",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 16px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Хэш
                    </th>
                    <th
                      style={{
                        width: "12%",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 10px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Университет
                    </th>
                    <th
                      style={{
                        width: "12%",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 10px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Кафедра
                    </th>
                    <th
                      style={{
                        width: "30%",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 10px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Документ
                    </th>
                    <th
                      style={{
                        width: "18%",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 10px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Статус
                    </th>
                    <th
                      style={{
                        width: "15%",
                        textAlign: "right",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-subtle)",
                        padding: "12px 16px",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
                      }}
                    >
                      Время
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTxRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: 28,
                          textAlign: "center",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          borderBottom: "none",
                        }}
                      >
                        Нет записей для отображения
                      </td>
                    </tr>
                  ) : (
                    topTxRows.map((row) => {
                    const hasTx = Boolean(row.blockchain_tx_hash);
                    const badge = statusTxBadge(row.status, hasTx);
                    const uni = universityLabelForRow(row, universities);
                    const dept = departmentCell(row);
                    return (
                      <tr key={row.id}>
                        <td
                          style={{
                            padding: "13px 16px",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 12,
                            color: "var(--text-muted)",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                          title={row.blockchain_tx_hash || undefined}
                        >
                          {formatTxShort(row.blockchain_tx_hash)}
                        </td>
                        <td
                          style={{
                            padding: "13px 10px",
                            fontSize: 13,
                            color: "var(--text)",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                          title={uni !== "—" ? uni : undefined}
                        >
                          {uni === "—" ? "—" : truncateCell(uni, 14)}
                        </td>
                        <td
                          style={{
                            padding: "13px 10px",
                            fontSize: 13,
                            color: "var(--text-muted)",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                          title={dept !== "—" ? dept : undefined}
                        >
                          {dept}
                        </td>
                        <td
                          style={{
                            padding: "13px 10px",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                            minWidth: 0,
                          }}
                        >
                          <Link to={`/files/${row.id}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>
                            {truncateFileName(row.file_name, 36)}
                          </Link>
                        </td>
                        <td
                          style={{
                            padding: "13px 10px",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            verticalAlign: "middle",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              height: 26,
                              padding: "0 10px",
                              borderRadius: 7,
                              fontSize: 11,
                              fontWeight: 600,
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "13px 16px",
                            textAlign: "right",
                            fontSize: 12,
                            color: "var(--text-muted)",
                            borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                        >
                          {relativeTime(row.created_at)}
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: BLOCK_GAP, minWidth: 0 }}>
            <div style={{ ...c, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>
                По университетам
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {uniCounts.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных справочника</div>
                ) : (
                  uniCounts.map(({ u, onChainCount, totalUploadedCount, progressPercent }) => (
                    <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(72px, 0.35fr) 1fr minmax(28px, auto)",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={u.name}
                        >
                          {u.short_name || u.name}
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: "color-mix(in srgb, var(--border) 55%, transparent)",
                            overflow: "hidden",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: `linear-gradient(90deg, ${AC.tealDeep}, ${AC.teal})`,
                              minWidth: onChainCount > 0 && progressPercent > 0 ? 2 : 0,
                              maxWidth: "100%",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text)",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {onChainCount}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        {onChainCount} из {totalUploadedCount} в блокчейне
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ ...c, flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>
                Статус обработки
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { dot: AC.teal, label: "В блокчейне", n: st.inBlockchain },
                  { dot: AC.gray, label: "Зафиксированы", n: st.frozenUploaded },
                  { dot: AC.blue, label: "У кафедры", n: st.underDeptStage },
                  { dot: AC.orange, label: "У деканата", n: st.underDeanStage },
                  { dot: AC.orange, label: "После деканата (до записи)", n: st.awaitingOnChain },
                  { dot: AC.red, label: "Отклонено", n: st.rejected },
                ].map((row) => (
                  <li
                    key={row.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "10px 1fr minmax(28px, auto)",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 22,
                    }}
                  >
                    <Dot color={row.dot} />
                    <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{row.label}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.n}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="admin-dash-bottom-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: BLOCK_GAP,
            alignItems: "stretch",
          }}
        >
          {[
            {
              icon: <Check size={20} color={AC.tealDeep} aria-hidden />,
              iconBg: `linear-gradient(145deg, ${AC.tealMutedBg}, color-mix(in srgb, ${AC.teal} 22%, var(--surface)))`,
              label: "Верифицировано сегодня",
              value: st.verifiedToday,
            },
            {
              icon: <Table2 size={20} color={AC.blue} aria-hidden />,
              iconBg: `linear-gradient(145deg, ${AC.blueMutedBg}, color-mix(in srgb, ${AC.blue} 18%, var(--surface)))`,
              label: "Активных университетов",
              value: universities.length,
            },
            {
              icon: <AlertCircle size={20} color={AC.orange} aria-hidden />,
              iconBg: `linear-gradient(145deg, ${AC.orangeMutedBg}, color-mix(in srgb, ${AC.orange} 16%, var(--surface)))`,
              label: "Ожидают on-chain",
              value: pendingOnChain.length,
            },
          ].map((w) => (
            <div
              key={w.label}
              style={{
                ...c,
                minHeight: 96,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: w.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset",
                }}
              >
                {w.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{w.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>{w.value}</div>
              </div>
            </div>
          ))}
        </section>

        <footer className="row" style={{ gap: 12, paddingTop: 4 }}>
          <Link to="/admin" className="ui-btn ui-btn--primary ui-btn--md" style={{ textDecoration: "none" }}>
            Админ-панель
          </Link>
          <Link to="/verify" className="ui-btn ui-btn--secondary ui-btn--md" style={{ textDecoration: "none" }}>
            Верификация
          </Link>
        </footer>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .admin-dash-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .admin-dash-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .admin-dash-metrics-grid { grid-template-columns: 1fr !important; }
          .admin-dash-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashPageWrap>
  );
};
