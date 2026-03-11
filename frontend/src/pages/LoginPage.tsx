import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
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
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Ошибка входа. Проверьте учетные данные.");
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 48 }}>
      <PageHeader title="Вход" subtitle="Используйте свои учетные данные" />
      <div className="card" style={{ marginTop: 16 }}>
        <p className="muted">JWT-аутентификация. Для демонстрации диплома.</p>
        <form onSubmit={submit} className="grid" style={{ marginTop: 16 }}>
          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="label">Пароль</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit">
            Войти
          </button>
          <div className="muted">
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

