import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";

type Health = {
  status: string;
  project?: string;
  version?: string;
  description?: string;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type PendingDoc = {
  id: string;
  file_name: string;
  sha256_hash: string;
  owner_email?: string | null;
  created_at: string;
};

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [health, setHealth] = useState<Health | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadPending = () => {
    api
      .get<PendingDoc[]>("/admin/documents/pending")
      .then((r) => setPendingDocs(r.data))
      .catch(() => setPendingDocs([]));
  };

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      api
        .get<Health>("/health")
        .then((r) => setHealth(r.data))
        .catch(() => setHealth({ status: "error" })),
      api
        .get<AdminUser[]>("/admin/users")
        .then((r) => setUsers(r.data))
        .catch(() => setUsers([])),
    ]).finally(() => setLoading(false));
    loadPending();
  }, []);

  const registerViaFilesApi = (id: string) => {
    setActionId(id);
    api
      .post(`/files/${id}/register`)
      .then(() => {
        loadPending();
        notify("success", "Документ зарегистрирован (POST /files/.../register).");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка регистрации");
      })
      .finally(() => setActionId(null));
  };

  const approveDoc = (id: string) => {
    setActionId(id);
    api
      .post(`/admin/documents/${id}/approve`)
      .then(() => {
        loadPending();
        notify("success", "Документ зарегистрирован в блокчейне.");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка регистрации");
      })
      .finally(() => setActionId(null));
  };

  const rejectDoc = (id: string) => {
    setActionId(id);
    api
      .post(`/admin/documents/${id}/reject`)
      .then(() => {
        loadPending();
        notify("success", "Заявка отклонена.");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка отклонения");
      })
      .finally(() => setActionId(null));
  };

  const updateRole = (id: string, role: string) => {
    api
      .patch(`/admin/users/${id}`, { role })
      .then(() => {
        setUsers((old) => old.map((u) => (u.id === id ? { ...u, role } : u)));
        notify("success", "Роль пользователя обновлена");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка обновления роли");
      });
  };

  const deleteUser = (id: string) => {
    api
      .delete(`/admin/users/${id}`)
      .then(() => {
        setUsers((old) => old.filter((u) => u.id !== id));
        notify("success", "Пользователь удалён");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка удаления");
      });
  };

  if (user?.role !== "admin") {
    return (
      <div className="page admin-page">
        <PageHeader title="Админ-панель" />
        <div className="card">
          <div className="bad">
            Требуется роль <code>admin</code> для доступа к административным функциям.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <PageHeader
        title="Админ-панель"
        subtitle="Финальная on-chain регистрация и пользователи (согласование — только деканат)"
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2.2fr) minmax(0,3fr)", gap: 16 }}>
        <div className="card card--subtle">
          <div className="label">Общее состояние</div>
          {loading && !health ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div>
                <span className="muted">Статус:</span> <code>{health?.status ?? "—"}</code>
              </div>
              {health?.project && (
                <div style={{ marginTop: 4 }}>
                  <span className="muted">Проект:</span> {health.project}
                </div>
              )}
              {health?.version && (
                <div style={{ marginTop: 2 }}>
                  <span className="muted">Версия:</span> {health.version}
                </div>
              )}
              {health?.description && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {health.description}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card card--subtle">
          <div className="label">Политика доступа</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
            Кафедра загружает и подаёт документ; деканат подтверждает единственный этап согласования; администратор
            выполняет только финальную запись в блокчейн и управление учётными записями (не участвует в согласовании).
          </div>
        </div>
      </div>

      <section className="admin-zone admin-zone--final">
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Очередь APPROVED → on-chain</h2>
          <p className="admin-zone__sub">
            Документы со статусом <code>APPROVED</code> после подтверждения деканатом. Кнопка записывает хэш и метаданные
            в смарт-контракт.
          </p>
        </div>
        <div className="admin-zone__body">
          {pendingDocs.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>
              Нет документов, ожидающих on-chain регистрации.
            </div>
          ) : (
            <div className="ui-table-wrap table-scroll">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Владелец</th>
                    <th>Дата</th>
                    <th>Финальная регистрация</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDocs.map((d) => (
                    <tr key={d.id}>
                      <td>{d.file_name}</td>
                      <td>{d.owner_email || "—"}</td>
                      <td>{new Date(d.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => approveDoc(d.id)}
                            disabled={actionId === d.id}
                          >
                            {actionId === d.id ? "…" : "Зарегистрировать в сети"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-muted"
                            title="Альтернативный маршрут pipeline"
                            onClick={() => registerViaFilesApi(d.id)}
                            disabled={actionId === d.id}
                          >
                            /files/register
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => rejectDoc(d.id)}
                            disabled={actionId === d.id}
                          >
                            Отказать
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="admin-zone admin-zone--users">
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Пользователи</h2>
          <p className="admin-zone__sub">Роли и учётные записи платформы.</p>
        </div>
        <div className="admin-zone__body">
          {loading ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div className="ui-table-wrap table-scroll">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Активен</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value)}
                          className="input"
                          style={{ maxWidth: 140, fontSize: 13, padding: "6px 8px" }}
                        >
                          <option value="user">user</option>
                          <option value="department">department</option>
                          <option value="dean">dean</option>
                          <option value="registrar">registrar</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        {u.is_active ? <span className="ok">active</span> : <span className="muted">inactive</span>}
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
