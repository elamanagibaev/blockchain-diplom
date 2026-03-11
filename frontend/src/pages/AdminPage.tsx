import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      api.get("/health").then((r) => setHealth(r.data)).catch(() => setHealth({ status: "error" })),
      api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => setUsers([])),
    ]).finally(() => setLoading(false));
  }, []);


  const updateRole = (id: string, role: string) => {
    api.patch(`/admin/users/${id}`, { role }).then(() => {
      setUsers((old) => old.map(u => u.id === id ? { ...u, role } : u));
    });
  };

  const deleteUser = (id: string) => {
    api.delete(`/admin/users/${id}`).then(() => {
      setUsers((old) => old.filter(u => u.id !== id));
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="grid">
        <PageHeader title="Админ панель" />
        <div className="card">
          <div className="muted">Требуется роль <code>admin</code>.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <PageHeader title="Админ панель" subtitle="Управление системой" />
      <div className="card">
        <div className="muted">Здесь можно расширить управление пользователями/политиками безопасности.</div>
        <div style={{ marginTop: 12 }}>
          <span className="muted">Health:</span> <code>{health ? JSON.stringify(health) : "..."}</code>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Пользователи</h3>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="form-control"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>
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

