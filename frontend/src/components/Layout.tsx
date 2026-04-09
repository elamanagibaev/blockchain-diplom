import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, Moon, Sun, ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const onLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  const displayName = user?.email?.split("@")[0] || user?.email || "Пользователь";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand" onClick={() => setNavOpen(false)}>
            <div className="app-brand-mark">
              <GraduationCap size={20} strokeWidth={2} />
            </div>
            <div className="app-brand-text">
              <div className="app-brand-title">ДипломЧейн</div>
              <div className="app-brand-subtitle">Верификация на блокчейне</div>
            </div>
          </Link>

          <nav className={`app-nav ${navOpen ? "app-nav--open" : ""}`} id="app-main-nav">
            {user?.role === "department" && (
              <Link
                to="/upload"
                className={`app-nav-link ${isActive("/upload") ? "app-nav-link--active" : ""}`}
                onClick={() => setNavOpen(false)}
              >
                Загрузка
              </Link>
            )}
            <Link
              to="/files"
              className={`app-nav-link ${isActive("/files") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Мои документы
            </Link>
            <Link
              to="/global"
              className={`app-nav-link ${isActive("/global") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Реестр
            </Link>
            <Link
              to="/verify"
              className={`app-nav-link ${isActive("/verify") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Верификация
            </Link>
            <Link
              to="/profile"
              className={`app-nav-link ${isActive("/profile") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Профиль
            </Link>
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className={`app-nav-link ${isActive("/admin") ? "app-nav-link--active" : ""}`}
                onClick={() => setNavOpen(false)}
              >
                Админ
              </Link>
            )}
          </nav>

          <div className="app-header-actions">
            <div className="app-user-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="app-user-trigger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
              >
                <span className="app-user-avatar">{initial}</span>
                <span className="app-user-email" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email || "—"}
                </span>
                <ChevronDown size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
              </button>
              {menuOpen && (
                <div className="app-dropdown">
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>
                    <User size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Профиль
                  </Link>
                  <button type="button" onClick={onLogout}>
                    <LogOut size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Выйти
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              className="app-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="app-main-nav"
              aria-label={navOpen ? "Закрыть меню" : "Открыть меню"}
              onClick={() => setNavOpen((v) => !v)}
            >
              <span className="app-nav-toggle-bar" />
              <span className="app-nav-toggle-bar" />
              <span className="app-nav-toggle-bar" />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
};
