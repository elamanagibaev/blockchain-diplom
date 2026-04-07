import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";
import { getLoginHistory, addToLoginHistory } from "../utils/loginHistory";
import { api } from "../api/client";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

type LoginTab = "email" | "wallet";

export const LoginPage: React.FC = () => {
  const { login, loginWithToken } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LoginTab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
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

  const submitWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      setError("Установите MetaMask или другой Web3 кошелёк");
      notify("error", "MetaMask не найден");
      return;
    }
    setWalletLoading(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = walletAddress.trim() || accounts[0];
      if (!addr) {
        setError("Выберите кошелёк в MetaMask");
        return;
      }
      setWalletAddress(addr);

      const { data: challenge } = await api.post<{ message_to_sign: string }>("/auth/wallet/challenge", {
        wallet_address: addr,
      });

      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(eth as never);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(challenge.message_to_sign);

      const { data: tokenRes } = await api.post<{ access_token: string }>("/auth/wallet/verify", {
        wallet_address: addr,
        signature,
      });
      localStorage.setItem("access_token", tokenRes.access_token);
      await loginWithToken();
      navigate("/");
      notify("success", "Вход выполнен через кошелёк");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg =
        typeof ax?.response?.data?.detail === "string" ? ax.response.data.detail : "Ошибка входа через кошелёк";
      setError(msg);
      notify("error", msg);
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <AuthLayout title="Вход" subtitle="Email и пароль или кошелёк">
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`tab ${tab === "email" ? "tab--active" : ""}`}
          onClick={() => {
            setTab("email");
            setError(null);
          }}
        >
          Email
        </button>
        <button
          type="button"
          className={`tab ${tab === "wallet" ? "tab--active" : ""}`}
          onClick={() => {
            setTab("wallet");
            setError(null);
          }}
        >
          Кошелёк
        </button>
      </div>

      {tab === "email" ? (
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
      ) : (
        <form onSubmit={submitWallet} className="stack">
          <Input
            label="Адрес кошелька (или подключите MetaMask)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x…"
          />
          <p className="muted" style={{ fontSize: 12 }}>
            Сначала зарегистрируйтесь через email — кошелёк можно привязать позже.
          </p>
          {error && <div className="bad">{error}</div>}
          <Button type="submit" variant="primary" loading={walletLoading} disabled={walletLoading}>
            Войти через кошелёк
          </Button>
          <p className="muted" style={{ fontSize: 14 }}>
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};
