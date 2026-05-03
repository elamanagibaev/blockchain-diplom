import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"department" | "dean">("department");
  const [registrationCode, setRegistrationCode] = useState("");
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
    if (!/^\d{5}$/.test(registrationCode.trim())) {
      setError("Код университета должен состоять из 5 цифр");
      return;
    }

    try {
      await api.post("/auth/register", {
        email,
        full_name: fullName || null,
        password,
        role,
        registration_code: registrationCode.trim(),
      });
      notify("success", "Аккаунт создан. Войдите в систему.");
      navigate("/login");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string | { msg?: string }[] } } };
      const detail = ax?.response?.data?.detail;
      let msg = "Не удалось зарегистрироваться. Проверьте данные.";
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail[0]?.msg || "Ошибка при регистрации";
      setError(msg);
      notify("error", msg);
    }
  };

  return (
    <AuthLayout title="Регистрация" subtitle="Регистрация для кафедры и деканата по коду университета">
      <form onSubmit={submit} className="stack">
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Роль</span>
          <select value={role} onChange={(e) => setRole(e.target.value as "department" | "dean")} className="input">
            <option value="department">Кафедра</option>
            <option value="dean">Деканат</option>
          </select>
        </label>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.ru" autoComplete="email" />
        <Input label="ФИО (опционально)" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов И.И." />
        {(role === "department" || role === "dean") && (
          <Input
            label="Код университета"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
            placeholder="12345"
          />
        )}
        <Input
          label="Пароль (мин. 8 символов, буквы разного регистра и цифра)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && <div className="bad">{error}</div>}
        <Button type="submit" variant="primary">
          Создать аккаунт
        </Button>
        <p className="muted" style={{ fontSize: 14 }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </AuthLayout>
  );
};
