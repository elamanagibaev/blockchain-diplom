import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { BRAND_NAME } from "../constants/brand";
import { Footer } from "./Footer";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-shell">
      <div className="auth-top">
        <Link to="/login" className="app-brand">
          <div className="app-brand-mark">
            <GraduationCap size={20} strokeWidth={2} />
          </div>
          <div className="app-brand-text">
            <div className="app-brand-title">{BRAND_NAME}</div>
          </div>
        </Link>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ marginBottom: 20 }}>
            <h1 className="auth-header-title">{title}</h1>
            {subtitle && <div className="auth-header-subtitle">{subtitle}</div>}
          </div>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};
