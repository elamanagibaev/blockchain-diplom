import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    void api.get("/health").then((r) => setHealth(r.data)).catch(() => setHealth({ status: "error" }));
  }, []);

  if (user?.role !== "admin") {
    return (
      <div className="grid">
        <div className="card">
          <h2>Admin</h2>
          <div className="muted">Требуется роль <code>admin</code>.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Admin панель (MVP)</h2>
        <div className="muted">Здесь можно расширить управление пользователями/политиками безопасности.</div>
        <div style={{ marginTop: 12 }}>
          <span className="muted">Health:</span> <code>{health ? JSON.stringify(health) : "..."}</code>
        </div>
      </div>
    </div>
  );
};

