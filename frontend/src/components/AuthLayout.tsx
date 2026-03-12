import React from "react";
import { Footer } from "./Footer";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
  return (
    <div className="auth-shell">
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ marginBottom: 16 }}>
            <div className="badge badge-soft-blue badge-pill" style={{ marginBottom: 8 }}>
              BlockProof — Blockchain platform for data verification
            </div>
            <h1 className="auth-header-title">{title}</h1>
            {subtitle && <div className="auth-header-subtitle">{subtitle}</div>}
          </div>
          {children}
        </div>
      </main>
      <div className="auth-footer">
        <span className="footer-brand">BlockProof</span>
        <span className="footer-project">Дипломный проект Агибаев Еламан и Кубышкин Константин</span>
      </div>
    </div>
  );
};

