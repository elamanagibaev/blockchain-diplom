import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand" onClick={() => setNavOpen(false)}>
            <div className="app-brand-mark">BP</div>
            <div className="app-brand-text">
              <div className="app-brand-title">BlockProof</div>
              <div className="app-brand-subtitle">Патенты в блокчейне</div>
            </div>
          </Link>

          <nav className={`app-nav ${navOpen ? "app-nav--open" : ""}`} id="app-main-nav">
            <Link
              to="/profile"
              className={`app-nav-link ${isActive("/profile") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Профиль
            </Link>
            <Link
              to="/upload"
              className={`app-nav-link ${isActive("/upload") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Загрузка
            </Link>
            <Link
              to="/files"
              className={`app-nav-link ${isActive("/files") ? "app-nav-link--active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              Мои патенты
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
            {user?.email && (
              <div className="app-user-pill">
                {user.email}
                {user.wallet_address && (
                  <span style={{ opacity: 0.7, fontSize: 11 }}>
                    {" "}
                    · {user.wallet_address.slice(0, 8)}…
                  </span>
                )}
                {user.role && <span style={{ opacity: 0.8 }}> · {user.role}</span>}
              </div>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}>
              Выйти
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
        <div className="page-container">
          <section className="page-main">
            <Outlet />
          </section>
          <aside className="page-sidebar">
            <div className="page-sidebar-card">
              <h3>О платформе</h3>
              <p>
                Защищённое хранение файлов и фиксация хэшей в блокчейне для проверки подлинности патентных
                документов.
              </p>
              <ul className="page-sidebar-list">
                <li>
                  <span className="page-sidebar-dot" />
                  Хэш фиксируется on-chain
                </li>
                <li>
                  <span className="page-sidebar-dot" />
                  Содержимое остаётся в off-chain хранилище
                </li>
                <li>
                  <span className="page-sidebar-dot" />
                  Запись в реестре устойчива к скрытым правкам
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};
