import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

export type User = {
  id: string;
  email: string;
  full_name?: string | null;
  role: "user" | "admin" | string;
  wallet_address?: string | null;
  wallet_status?: string;
  document_count?: number;
  on_chain_count?: number;
  university_id?: number | null;
  university_name?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) void fetchMe();
    else setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = new URLSearchParams();
    data.append("username", email);
    data.append("password", password);
    const res = await api.post("/auth/login", data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    localStorage.setItem("access_token", res.data.access_token);
    await fetchMe();
  };

  const loginWithToken = async (token?: string) => {
    if (token) localStorage.setItem("access_token", token);
    await fetchMe();
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, loginWithToken, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

