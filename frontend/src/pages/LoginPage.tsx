import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { AuthLayout } from "../components/AuthLayout";
import { getLoginHistory, addToLoginHistory } from "../utils/loginHistory";
import { api } from "../api/client";

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
    } catch (err: any) {
      const msg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Ошибка входа.";
      setError(msg);
      notify("error", msg);
    }
  };

  const submitWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("Установите MetaMask или другой Web3 кошелёк");
      notify("error", "MetaMask не найден");
      return;
    }
    setWalletLoading(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = walletAddress.trim() || (accounts[0] as string);
      if (!addr) {
        setError("Выберите кошелёк в MetaMask");
        return;
      }
      setWalletAddress(addr);

      const { data: challenge } = await api.post<{ message_to_sign: string }>("/auth/wallet/challenge", {
        wallet_address: addr,
      });

      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(eth);
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
    } catch (err: any) {
      const msg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Ошибка входа через кошелёк";
      setError(msg);
      notify("error", msg);
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Вход в BlockProof"
      subtitle="Email/пароль или вход через кошелёк"
    >
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--color-border)" }}>
        <button
          type="button"
          className="btn btn-muted"
          style={{
            border: "none",
            borderRadius: 0,
            borderBottom: tab === "email" ? "2px solid var(--color-primary)" : "2px solid transparent",
            marginBottom: -1,
          }}
          onClick={() => { setTab("email"); setError(null); }}
        >
          Email
        </button>
        <button
          type="button"
          className="btn btn-muted"
          style={{
            border: "none",
            borderRadius: 0,
            borderBottom: tab === "wallet" ? "2px solid var(--color-primary)" : "2px solid transparent",
            marginBottom: -1,
          }}
          onClick={() => { setTab("wallet"); setError(null); }}
        >
          Кошелёк
        </button>
      </div>

      {tab === "email" ? (
        <form onSubmit={submitEmail} className="grid" style={{ marginTop: 8 }}>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patentee@example.com"
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
            Войти
          </button>
          {history.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="label" style={{ fontSize: 12, marginBottom: 6 }}>Ранее входили:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {history.map((h) => (
                  <button
                    key={h.email}
                    type="button"
                    className="btn btn-muted btn-sm"
                    onClick={() => setEmail(h.email)}
                  >
                    {h.email}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="muted">
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </div>
        </form>
      ) : (
        <form onSubmit={submitWallet} className="grid" style={{ marginTop: 8 }}>
          <div>
            <div className="label">Wallet address (или подключите MetaMask)</div>
            <input
              className="input"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
            />
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Сначала зарегистрируйтесь через email — кошелёк привязывается автоматически.
            </div>
          </div>
          {error && <div className="bad">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={walletLoading}>
            {walletLoading ? "Подписание…" : "Войти через кошелёк"}
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            Подпишите сообщение в MetaMask — вход без пароля.
          </div>
          <div className="muted">
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

