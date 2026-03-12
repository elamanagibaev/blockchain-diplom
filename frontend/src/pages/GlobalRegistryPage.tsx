import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";

type DocRow = {
  id: string;
  file_name: string;
  title?: string | null;
  sha256_hash: string;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
  blockchain_registered_at?: string | null;
  owner_wallet_address?: string | null;
  owner_email?: string | null;
};

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

  const displayName = (r: DocRow) => r.title || r.file_name;

  return (
    <div className="page">
      <PageHeader
        title="Общая база патентов и документов"
        subtitle="Все документы всех пользователей, зарегистрированные в платформе"
      />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div className="label">Поиск и фильтры</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Все документы в системе. Владелец и wallet привязываются при регистрации в блокчейне.
            </div>
          </div>
          <button className="btn btn-muted btn-sm" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        <div className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 240 }}>
            <input
              className="input"
              placeholder="Поиск по названию или хэшу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <input
              className="input"
              placeholder="Wallet владельца..."
              value={ownerWallet}
              onChange={(e) => setOwnerWallet(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <input
              className="input"
              placeholder="Tx hash..."
              value={txHashFilter}
              onChange={(e) => setTxHashFilter(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="UPLOADED">Загружен</option>
              <option value="REGISTERED">Off-chain</option>
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
              <option value="blockchain_registered_at-desc">On-chain (новые)</option>
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
              Загрузите документ на странице загрузки, чтобы он появился здесь.
            </div>
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
              Загрузить документ
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Владелец</th>
                  <th>Wallet</th>
                  <th>Статус</th>
                  <th>Загружен</th>
                  <th>В блокчейне</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/files/${r.id}`} style={{ fontWeight: 500 }}>
                        {displayName(r)}
                      </Link>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        <code>{r.sha256_hash.slice(0, 16)}…</code>
                      </div>
                    </td>
                    <td>{r.owner_email || "—"}</td>
                    <td>
                      <code style={{ fontSize: 11 }}>
                        {r.owner_wallet_address
                          ? `${r.owner_wallet_address.slice(0, 10)}…${r.owner_wallet_address.slice(-6)}`
                          : "—"}
                      </code>
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          r.status === "REGISTERED" && !r.blockchain_tx_hash
                            ? "PENDING_ON_CHAIN"
                            : r.status
                        }
                      />
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString("ru-RU")}</td>
                    <td>
                      {r.blockchain_registered_at ? (
                        new Date(r.blockchain_registered_at).toLocaleDateString("ru-RU")
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
