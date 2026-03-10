import React from "react";
import { useAuth } from "../context/AuthContext";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="grid">
      <div className="card">
        <h2>Dashboard</h2>
        <p className="muted">
          Пользователь: <strong>{user?.email}</strong> (роль: <code>{user?.role}</code>)
        </p>
        <div style={{ marginTop: 12 }} className="muted">
          Идея диплома: файл хранится off-chain, на блокчейне фиксируем контрольные записи (хэш, время, владелец, история действий).
        </div>
      </div>
    </div>
  );
};

