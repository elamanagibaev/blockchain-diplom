import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";

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

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [health, setHealth] = useState<Health | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, []);

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
      <div className="page">
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
    <div className="page">
      <PageHeader
        title="Админ-панель"
        subtitle="Управление пользователями и мониторинг состояния платформы"
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2.2fr) minmax(0,3fr)" }}>
        <div className="card">
          <div className="label">Общее состояние</div>
          {loading && !health ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div><span className="muted">Статус:</span> <code>{health?.status ?? "—"}</code></div>
              {health?.project && (
                <div style={{ marginTop: 4 }}><span className="muted">Проект:</span> {health.project}</div>
              )}
              {health?.version && (
                <div style={{ marginTop: 2 }}><span className="muted">Версия:</span> {health.version}</div>
              )}
              {health?.description && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{health.description}</div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="label">Политика доступа</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Роли <code>user</code> и <code>admin</code> используются для разграничения прав: обычные пользователи
            работают со своими документами, администраторы управляют регистрацией on-chain и политиками
            безопасности.
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Пользователи</h3>
        {loading ? (
          <div className="text-center" style={{ padding: "12px 0" }}>
            <Spinner size={28} />
          </div>
        ) : (
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
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="ok">active</span>
                    ) : (
                      <span className="muted">inactive</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteUser(u.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

