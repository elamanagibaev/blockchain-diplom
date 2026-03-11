import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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

    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      const msg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Ошибка входа. Проверьте учетные данные.";
      setError(msg);
      notify("error", msg);
    }
  };

  return (
    <AuthLayout
      title="Вход в MediChain Records"
      subtitle="Авторизуйтесь, чтобы работать с медицинскими документами"
    >
      <form onSubmit={submit} className="grid" style={{ marginTop: 8 }}>
        <div>
          <div className="label">Email</div>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="doctor@example.com"
          />
        </div>
        <div>
          <div className="label">Пароль</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
          />
        </div>
        {error && <div className="bad">{error}</div>}
        <button className="btn btn-primary" type="submit">
          Войти в систему
        </button>
        <div className="muted">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </div>
      </form>
    </AuthLayout>
  );
};

