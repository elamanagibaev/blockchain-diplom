import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { FileTable, FileRow } from "../components/FileTable";

export const MyFilesPage: React.FC = () => {
  const [items, setItems] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get("/files");
      setItems(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки списка");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Мои файлы</h2>
            <div className="muted">Таблица объектов из PostgreSQL (off-chain).</div>
          </div>
          <button className="btn btn-muted" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        {error && <div className="bad" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div className="card">
        <FileTable items={items} />
      </div>
    </div>
  );
};

