import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";

type DocRow = {
  id: string;
  file_name: string;
  title?: string | null;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
  blockchain_registered_at?: string | null;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
  last_transfer_from_wallet?: string | null;
  last_transfer_to_wallet?: string | null;
};

function formatRuDateTimeSeconds(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function shortWallet(addr: string | null | undefined): string {
  if (!addr || addr.length < 12) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type ActionKind = "sale" | "reject" | "review" | "registered";

function mapRegistryAction(status: string, blockchainTx: string | null | undefined): { label: string; kind: ActionKind } {
  if (status === "TRANSFERRED") {
    return { label: "Продажа", kind: "sale" };
  }
  if (status === "REJECTED") {
    return { label: "Отклонение", kind: "reject" };
  }
  if (blockchainTx || status === "REGISTERED_ON_CHAIN") {
    return { label: "Зарегистрирован", kind: "registered" };
  }
  return { label: "Рассмотрение", kind: "review" };
}

const actionBadgeStyle: Record<ActionKind, React.CSSProperties> = {
  sale: { background: "#2563eb", color: "#fff" },
  reject: { background: "#dc2626", color: "#fff" },
  review: { background: "#ca8a04", color: "#fff" },
  registered: { background: "#16a34a", color: "#fff" },
};

function WalletCell({ address }: { address: string | null | undefined }) {
  if (!address) {
    return <span className="muted">—</span>;
  }
  return (
    <Link
      to={`/profile/user?w=${encodeURIComponent(address)}`}
      title={address}
      className="registry-wallet-link"
      style={{
        fontFamily: "ui-monospace, monospace",
        fontSize: 13,
        color: "var(--color-primary)",
        textDecoration: "none",
        borderBottom: "1px dashed rgba(252, 213, 53, 0.35)",
      }}
    >
      {shortWallet(address)}
    </Link>
  );
}

export const GlobalRegistryPage: React.FC = () => {
  const [items, setItems] = useState<DocRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerWallet, setOwnerWallet] = useState("");
  const [txHashFilter, setTxHashFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (ownerWallet.trim()) params.owner_wallet = ownerWallet.trim();
      if (txHashFilter.trim()) params.tx_hash = txHashFilter.trim();
      params.sort_by = sortBy;
      params.sort_order = sortOrder;
      const res = await api.get<DocRow[]>("/files/global", { params });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [search, statusFilter, ownerWallet, txHashFilter, sortBy, sortOrder]);

  return (
    <div className="page">
      <PageHeader
        title="Общая база патентов и документов"
        subtitle="Все документы, зарегистрированные в платформе"
      />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div className="label">Поиск и фильтры</div>
            <div className="muted" style={{ fontSize: 12 }}>
              По клику на кошелёк открывается карточка пользователя, если адрес есть в системе.
            </div>
          </div>
          <button type="button" className="btn btn-muted btn-sm" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        <div className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 240 }}>
            <input
              className="input"
              placeholder="Название или поисковый запрос"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <input
              className="input"
              placeholder="Фильтр по кошельку"
              value={ownerWallet}
              onChange={(e) => setOwnerWallet(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <input
              className="input"
              placeholder="Фрагмент хэша транзакции"
              value={txHashFilter}
              onChange={(e) => setTxHashFilter(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="UPLOADED">Загружен</option>
              <option value="REGISTERED">В реестре (вне сети)</option>
              <option value="PENDING_APPROVAL">На рассмотрении</option>
              <option value="REGISTERED_ON_CHAIN">В блокчейне</option>
              <option value="REJECTED">Отклонён</option>
              <option value="TRANSFERRED">Передан</option>
            </select>
          </div>
          <div style={{ minWidth: 140 }}>
            <select
              className="input"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const v = e.target.value;
                const [s, o] = v.split("-");
                setSortBy(s);
                setSortOrder(o as "asc" | "desc");
              }}
            >
              <option value="created_at-desc">Дата (новые)</option>
              <option value="created_at-asc">Дата (старые)</option>
              <option value="blockchain_registered_at-desc">В сети (новые)</option>
              <option value="file_name-asc">Название А–Я</option>
              <option value="file_name-desc">Название Я–А</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: 24 }}>
            <Spinner size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Нет документов в реестре</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Загрузите документ на странице «Загрузка», чтобы он появился здесь.
            </div>
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
              Загрузить документ
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full registry-table">
              <thead>
                <tr>
                  <th>Файл</th>
                  <th>Владелец</th>
                  <th>Покупатель</th>
                  <th>Действие</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const action = mapRegistryAction(r.status, r.blockchain_tx_hash);
                  const buyerWallet = r.last_transfer_to_wallet || null;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/files/${r.id}`} style={{ fontWeight: 500 }}>
                          {r.file_name}
                        </Link>
                      </td>
                      <td>
                        <WalletCell address={r.owner_wallet_address} />
                      </td>
                      <td>{buyerWallet ? <WalletCell address={buyerWallet} /> : <span className="muted">—</span>}</td>
                      <td>
                        <span
                          className="registry-action-badge"
                          style={{
                            ...actionBadgeStyle[action.kind],
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-block",
                          }}
                        >
                          {action.label}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {formatRuDateTimeSeconds(r.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
