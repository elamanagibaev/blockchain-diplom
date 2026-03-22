import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { FileTable, FileRow } from "../components/FileTable";
import { Spinner } from "../components/Spinner";
import { useNotification } from "../context/NotificationContext";

export const MyFilesPage: React.FC = () => {
  const location = useLocation();
  const { notify } = useNotification();
  const [items, setItems] = useState<FileRow[]>([]);
  const [filtered, setFiltered] = useState<FileRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState<string | null>(null);

  const load = async (q: string = "", status: string = "") => {
    setError(null);
    setLoading(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (status && status !== "ALL") params.status = status;
      const res = await api.get<FileRow[]>("/files", { params });
      setItems(res.data);
      setFiltered(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки списка");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
  };

  const onSubmitForRegistration = async (id: string) => {
    setLoadingRegister(id);
    try {
      await api.post(`/files/${id}/submit-for-registration`);
      await load(search, statusFilter);
      notify("success", "Документ отправлен на рассмотрение и отображается в общем реестре.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Ошибка отправки заявки";
      setError(msg);
      notify("error", typeof msg === "string" ? msg : "Ошибка отправки заявки");
    } finally {
      setLoadingRegister(null);
    }
  };

  useEffect(() => {
    void load(search, statusFilter);
  }, [search, statusFilter, location.key]);

  return (
    <div className="page">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Мои патенты</h1>
            <div className="muted">
              Загруженные патентные документы. Фильтруйте по статусу и ищите по имени файла.
            </div>
          </div>
          <button className="btn btn-muted" onClick={() => void load(search, statusFilter)}>
            Обновить
          </button>
        </div>
        {error && (
          <div className="bad" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="row" style={{ marginTop: 12, gap: 12, alignItems: "flex-end" }}>
          <div style={{ maxWidth: 320, width: "100%" }}>
            <div className="label">Поиск</div>
            <input
              className="input"
              placeholder="Поиск по имени файла..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div style={{ maxWidth: 220, width: "100%" }}>
            <div className="label">Статус</div>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Все статусы</option>
              <option value="UPLOADED">Черновик</option>
              <option value="PENDING_APPROVAL">На проверке</option>
              <option value="REGISTERED_ON_CHAIN">Мой</option>
              <option value="REJECTED">Отклонён</option>
              <option value="TRANSFERRED">Получен</option>
            </select>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Нажмите «Рассмотреть» — документ появится в общем реестре и уйдёт администратору. После одобрения запись
          появится в смарт-контракте.
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: "16px 0" }}>
            <Spinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">Нет документов</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Загрузите патентный документ, затем нажмите «Рассмотреть», чтобы документ попал в общий реестр.
            </div>
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
              Загрузить патентный документ
            </Link>
          </div>
        ) : (
          <FileTable items={filtered} onSubmitForRegistration={onSubmitForRegistration} loadingId={loadingRegister} />
        )}
      </div>
    </div>
  );
};

