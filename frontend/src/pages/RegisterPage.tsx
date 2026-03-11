import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [wallet, setWallet] = useState("");
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
        wallet_address: wallet || null,
        password
      });
      navigate("/login");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail[0]?.msg || "Ошибка при регистрации");
      } else {
        setError("Не удалось зарегистрироваться. Проверьте данные.");
      }
    }
  };

  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: 48 }}>
      <PageHeader title="Регистрация" subtitle="Создайте учётную запись" />
      <div className="card" style={{ marginTop: 16 }}>
        <p className="muted">Файл не хранится в блокчейне — только хэш и контрольные записи.</p>
        <form onSubmit={submit} className="grid" style={{ marginTop: 16 }}>
          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="label">ФИО (опционально)</div>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <div className="label">Wallet address (опционально, нужно для on-chain регистрации)</div>
            <input className="input" value={wallet} onChange={(e) => setWallet(e.target.value)} />
          </div>
          <div>
            <div className="label">Пароль (мин. 8 символов)</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit">
            Создать аккаунт
          </button>
          <div className="muted">
            Уже есть аккаунт? <Link to="/login">Вход</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

