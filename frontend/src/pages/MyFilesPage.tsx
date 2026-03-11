import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { FileTable, FileRow } from "../components/FileTable";
import { Spinner } from "../components/Spinner";

export const MyFilesPage: React.FC = () => {
  const [items, setItems] = useState<FileRow[]>([]);
  const [filtered, setFiltered] = useState<FileRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loadingRegister, setLoadingRegister] = useState<string | null>(null);

  const load = async (q: string = "", status: string = "") => {
    setError(null);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (status && status !== "ALL") params.status = status;
      const res = await api.get("/files", { params });
      setItems(res.data);
      setFiltered(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки списка");
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
  };

  const onRegister = async (id: string) => {
    setLoadingRegister(id);
    try {
      await api.post(`/blockchain/register/${id}`);
      await load(search);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка регистрации");
    } finally {
      setLoadingRegister(null);
    }
  };

  useEffect(() => {
    void load(search, statusFilter);
  }, [search, statusFilter]);

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Мои документы</h2>
            <div className="muted">Список ваших загруженных медицинских записей.</div>
          </div>
          <button className="btn btn-muted" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        {error && <div className="bad" style={{ marginTop: 10 }}>{error}</div>}
        <div className="row" style={{ marginTop: 12, gap: 12 }}>
          <input
            className="input"
            placeholder="Поиск по имени или хэшу..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="ALL">Все статусы</option>
            <option value="REGISTERED">Registered</option>
            <option value="REGISTERED_ON_CHAIN">On-chain</option>
          </select>
        </div>
      </div>

      <div className="card">
        <FileTable items={filtered} onRegister={onRegister} loadingId={loadingRegister} />
      </div>
    </div>
  );
};

