import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";
import { getLoginHistory, addToLoginHistory } from "../utils/loginHistory";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ email: string; lastUsed: string }[]>([]);

  useEffect(() => {
    setHistory(getLoginHistory());
  }, []);

  const submitEmail = async (e: React.FormEvent) => {
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
      addToLoginHistory(email);
      navigate("/");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = typeof ax?.response?.data?.detail === "string" ? ax.response.data.detail : "Ошибка входа.";
      setError(msg);
      notify("error", msg);
    }
  };

  return (
    <AuthLayout title="Вход" subtitle="Email и пароль">
      <form onSubmit={submitEmail} className="stack">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoComplete="current-password"
        />
        {error && <div className="bad">{error}</div>}
        <Button type="submit" variant="primary" size="md">
          Войти
        </Button>
        {history.length > 0 && (
          <div>
            <div className="label" style={{ fontSize: 12 }}>
              Ранее входили:
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              {history.map((h) => (
                <button key={h.email} type="button" className="btn btn-muted btn-sm" onClick={() => setEmail(h.email)}>
                  {h.email}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="muted" style={{ fontSize: 14 }}>
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
      </form>
    </AuthLayout>
  );
};
