import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Email обязателен");
      return;
    }
    if (!password) {
      setError("Пароль обязателен");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Пароль должен содержать хотя бы одну заглавную букву");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Пароль должен содержать хотя бы одну строчную букву");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Пароль должен содержать хотя бы одну цифру");
      return;
    }

    try {
      await api.post("/auth/register", {
        email,
        full_name: fullName || null,
        password,
      });
      notify("success", "Аккаунт создан. Войдите в систему.");
      navigate("/login");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = "Не удалось зарегистрироваться. Проверьте данные.";
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail[0]?.msg || "Ошибка при регистрации";
      setError(msg);
      notify("error", msg);
    }
  };

  return (
    <AuthLayout
      title="Создание медицинского аккаунта"
      subtitle="При регистрации автоматически создаётся blockchain wallet для привязки документов"
    >
      <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
        <div>
          <div className="label">Email</div>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="clinic.admin@example.com"
          />
        </div>
        <div>
          <div className="label">ФИО (опционально)</div>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иванов И.И."
          />
        </div>
        <div>
          <div className="label">Пароль (мин. 8 символов)</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Надёжный пароль"
          />
        </div>
        {error && <div className="bad">{error}</div>}
        <button className="btn btn-primary" type="submit">
          Создать аккаунт
        </button>
        <div className="muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </form>
    </AuthLayout>
  );
};

