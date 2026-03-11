import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
          <Link to="/" className="app-brand">
            <div className="app-brand-mark">MR</div>
            <div className="app-brand-text">
              <div className="app-brand-title">MediChain Records</div>
              <div className="app-brand-subtitle">Защита целостности медицинских документов</div>
            </div>
          </Link>

          <nav className="app-nav">
            <Link
              to="/"
              className={`app-nav-link ${isActive("/") ? "app-nav-link--active" : ""}`}
            >
              Панель
            </Link>
            <Link
              to="/upload"
              className={`app-nav-link ${isActive("/upload") ? "app-nav-link--active" : ""}`}
            >
              Загрузка
            </Link>
            <Link
              to="/files"
              className={`app-nav-link ${isActive("/files") ? "app-nav-link--active" : ""}`}
            >
              Мои патенты
            </Link>
            <Link
              to="/global"
              className={`app-nav-link ${isActive("/global") ? "app-nav-link--active" : ""}`}
            >
              Общая база
            </Link>
            <Link
              to="/verify"
              className={`app-nav-link ${isActive("/verify") ? "app-nav-link--active" : ""}`}
            >
              Верификация
            </Link>
            <Link
              to="/profile"
              className={`app-nav-link ${isActive("/profile") ? "app-nav-link--active" : ""}`}
            >
              Профиль
            </Link>
            <Link
              to="/audit"
              className={`app-nav-link ${isActive("/audit") ? "app-nav-link--active" : ""}`}
            >
              Журнал
            </Link>
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className={`app-nav-link ${isActive("/admin") ? "app-nav-link--active" : ""}`}
              >
                Админ
              </Link>
            )}
          </nav>

          <div className="app-user">
            {user?.email && (
              <div className="app-user-pill">
                {user.email}
                {user.wallet_address && (
                  <span style={{ opacity: 0.7, fontSize: 11 }}>
                    {" "}· {user.wallet_address.slice(0, 8)}…
                  </span>
                )}
                {user.role && <span style={{ opacity: 0.8 }}> · {user.role}</span>}
              </div>
            )}
            <button className="btn btn-outline btn-sm" onClick={onLogout}>
              Выйти
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
              <h3>Безопасная медицинская платформа</h3>
              <p>
                Хранение файлов в защищённом хранилище и контрольные записи в блокчейне для проверки
                подлинности.
              </p>
              <ul className="page-sidebar-list">
                <li>
                  <span className="page-sidebar-dot" />
                  Хэш документа хранится on-chain
                </li>
                <li>
                  <span className="page-sidebar-dot" />
                  Файл остаётся в off-chain хранилище
                </li>
                <li>
                  <span className="page-sidebar-dot" />
                  Невозможность незаметно изменить историю записей
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

