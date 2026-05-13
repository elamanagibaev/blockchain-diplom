import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { documentListLabel } from "../utils/documentLabels";
import { getExplorerTxUrlOptional } from "../utils/blockExplorer";

type DocRow = {
  id: string;
  file_name: string;
  description?: string | null;
  title?: string | null;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
  blockchain_registered_at?: string | null;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
  uploaded_by_email?: string | null;
  uploaded_by_wallet_address?: string | null;
  last_transfer_from_wallet?: string | null;
  last_transfer_to_wallet?: string | null;
  trust_chain_status?: string | null;
  trust_chain_reason?: string | null;
  trust_chain_tx_hash?: string | null;
  trust_chain_tx_explorer_url?: string | null;
  trust_chain_actor_email?: string | null;
  trust_chain_actor_wallet_address?: string | null;
  tx_explorer_url?: string | null;
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

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length < 18) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function documentStatusRu(status: string): string {
  const map: Record<string, string> = {
    FROZEN: "Сформирован",
    UPLOADED: "Сформирован",
    UNDER_REVIEW: "На согласовании",
    PENDING_APPROVAL: "На согласовании",
    APPROVED: "Согласован",
    DEAN_APPROVED: "Подтверждён деканатом",
    REGISTERED: "Зарегистрирован",
    REGISTERED_ON_CHAIN: "Зарегистрирован в блокчейне",
    ASSIGNED_TO_OWNER: "Закреплён за выпускником",
    REJECTED: "Отклонён",
    TRANSFERRED: "Передан",
  };
  return map[status] || status;
}

function registryStatusMatches(row: DocRow, filter: string): boolean {
  if (!filter) return true;
  if (filter === "TRANSFERRED") return row.status === "TRANSFERRED";
  if (filter === "REGISTERED") {
    return Boolean(row.blockchain_tx_hash) && row.status !== "TRANSFERRED";
  }
  return row.status === filter;
}

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
        fontSize: 12,
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
  const { user } = useAuth();
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
      if (statusFilter && statusFilter !== "REGISTERED") params.status = statusFilter;
      if (ownerWallet.trim()) params.owner_wallet = ownerWallet.trim();
      if (txHashFilter.trim()) params.tx_hash = txHashFilter.trim();
      params.sort_by = sortBy;
      params.sort_order = sortOrder;
      const res = await api.get<DocRow[]>("/files/global", { params });
      const rows = res.data.filter((row) => registryStatusMatches(row, statusFilter));
      setItems(rows);
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
    <div className="page global-registry-page">
      <PageHeader
        title="Общий реестр"
        subtitle="Каталог документов платформы: статус, владелец, blockchain-запись и транзакция"
      />

      <div className="card card--subtle registry-filters">
        <div className="ui-card-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="ui-card-title">Поиск и фильтры</h2>
            <p className="ui-card-desc" style={{ maxWidth: "none" }}>
              Реестр показывает документы как каталог. События blockchain остаются в журнале.
            </p>
          </div>
          <button type="button" className="btn btn-muted btn-sm" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        <div className="page-toolbar" style={{ marginTop: 0 }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div className="label">Запрос</div>
            <input
              className="input"
              placeholder="Название или текст"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 160px", minWidth: 0 }}>
            <div className="label">Кошелёк владельца</div>
            <input
              className="input"
              placeholder="Фильтр по адресу"
              value={ownerWallet}
              onChange={(e) => setOwnerWallet(e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 160px", minWidth: 0 }}>
            <div className="label">Транзакция</div>
            <input
              className="input"
              placeholder="Фрагмент tx hash"
              value={txHashFilter}
              onChange={(e) => setTxHashFilter(e.target.value)}
            />
          </div>
          <div style={{ flex: "0 1 180px", minWidth: 0 }}>
            <div className="label">Статус</div>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="UNDER_REVIEW">На согласовании</option>
              <option value="REGISTERED">Зарегистрирован</option>
              <option value="ASSIGNED_TO_OWNER">Закреплён за выпускником</option>
              <option value="TRANSFERRED">Передан</option>
              <option value="REJECTED">Отклонён</option>
            </select>
          </div>
          <div style={{ flex: "0 1 200px", minWidth: 0 }}>
            <div className="label">Сортировка</div>
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
          <div className="text-center" style={{ padding: 28 }}>
            <Spinner size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state empty-state--soft">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Нет записей</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Загрузите документ — после отправки на рассмотрение он появится в реестре.
            </div>
            {user?.role === "department" && (
              <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
                Загрузить документ
              </Link>
            )}
          </div>
        ) : (
          <div className="ui-table-wrap table-scroll">
            <table className="w-full registry-table registry-table--documents">
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Владелец</th>
                  <th>Загрузил</th>
                  <th>Статус</th>
                  <th>Блокчейн</th>
                  <th>Транзакция</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const docLabel = documentListLabel(r);
                  const uploaderWallet = r.uploaded_by_wallet_address;
                  const uploaderLabel = r.uploaded_by_email || shortWallet(uploaderWallet);
                  const uploaderHref = uploaderWallet
                    ? `/profile/user?w=${encodeURIComponent(uploaderWallet)}`
                    : null;
                  const txHash = r.blockchain_tx_hash || r.trust_chain_tx_hash || "";
                  const txUrl = r.tx_explorer_url || r.trust_chain_tx_explorer_url || getExplorerTxUrlOptional(txHash);
                  const dateValue = r.blockchain_registered_at || r.created_at;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/files/${r.id}`} className="registry-doc-link registry-doc-link--primary" title={docLabel}>
                          {docLabel}
                        </Link>
                      </td>
                      <td>
                        <div className="registry-cell-main">{r.owner_email || "—"}</div>
                        <div className="registry-cell-sub">
                          <WalletCell address={r.owner_wallet_address} />
                        </div>
                      </td>
                      <td>
                        {uploaderHref ? (
                          <Link className="registry-cell-main" to={uploaderHref} title={uploaderWallet || uploaderLabel}>
                            {uploaderLabel}
                          </Link>
                        ) : (
                          <span className="registry-cell-main" title={r.uploaded_by_email || "—"}>{uploaderLabel}</span>
                        )}
                      </td>
                      <td>
                        <span className="registry-status-text">{documentStatusRu(r.status)}</span>
                      </td>
                      <td>
                        <div className="registry-cell-main">{r.blockchain_tx_hash ? "Записан" : "Нет записи"}</div>
                        {r.trust_chain_status === "BROKEN" && (
                          <div className="registry-cell-sub registry-integrity-note">
                            (целостность нарушена)
                          </div>
                        )}
                      </td>
                      <td>
                        {txHash ? (
                          <a className="registry-tx-link" href={txUrl || "#"} target="_blank" rel="noreferrer" title={txHash}>
                            {shortHash(txHash)}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="registry-date-cell">
                        {formatRuDateTimeSeconds(dateValue)}
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
