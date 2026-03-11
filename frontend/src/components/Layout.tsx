import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const active = (path: string) => location.pathname === path ? { textDecoration: 'underline' } : undefined;

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <header className="header">
        <div className="container row" style={{ justifyContent: "space-between" }}>
          <div className="navlinks" style={{ alignItems: "center" }}>
            <strong style={{ fontSize: 18 }}>MediChain Records</strong>
            <Link to="/" style={active("/")}>Dashboard</Link>
            <Link to="/upload" style={active("/upload")}>Upload</Link>
            <Link to="/files" style={active("/files")}>My documents</Link>
            <Link to="/verify" style={active("/verify")}>Verify</Link>
            {user?.role === "admin" && <Link to="/admin" style={active("/admin")}>Admin</Link>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ color: "#cbd5e1" }}>
              {user?.email}
            </span>
            <button className="btn btn-danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <Outlet />
      </main>

      <Footer />
    </>
  );
};

