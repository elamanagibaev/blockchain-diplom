import React, { useEffect } from "react";
import { Link, useLocation, useRoutes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadPage } from "./pages/UploadPage";
import { MyFilesPage } from "./pages/MyFilesPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { VerifyPage } from "./pages/VerifyPage";
import { AdminPage } from "./pages/AdminPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WalletProfileViewPage } from "./pages/WalletProfileViewPage";
import { GlobalRegistryPage } from "./pages/GlobalRegistryPage";
import { CertificatePage } from "./pages/CertificatePage";
import { VerifyDocPage } from "./pages/VerifyDocPage";
import { ExplorerPage } from "./explorer/ExplorerPage";
import { BRAND_NAME } from "./constants/brand";
import { Footer } from "./components/Footer";

const NotFoundPage: React.FC = () => (
  <div className="app-shell">
    <div style={{ textAlign: "center", paddingTop: 48, padding: 24, flex: 1 }}>
      <h1 style={{ marginBottom: 8 }}>404</h1>
      <p className="muted">Страница не найдена</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
        На главную
      </Link>
    </div>
    <Footer />
  </div>
);

export const App: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    const p = location.pathname;
    let page = "Платформа верификации документов";
    if (p === "/") page = "Панель";
    else if (p.startsWith("/upload")) page = "Загрузка документа";
    else if (p.startsWith("/files")) page = "Документы";
    else if (p.startsWith("/global")) page = "Реестр";
    else if (p.startsWith("/verify/hash")) page = "Проверка по хэшу";
    else if (p.startsWith("/verify/doc")) page = "Публичная справка";
    else if (p.startsWith("/verify")) page = "Верификация";
    else if (p.startsWith("/admin")) page = "Админ-панель";
    else if (p.startsWith("/explorer")) page = "Журнал операций";
    else if (p.startsWith("/profile")) page = "Профиль";
    else if (p.startsWith("/login")) page = "Вход";
    else if (p.startsWith("/register")) page = "Регистрация";
    document.title = `${BRAND_NAME} - ${page}`;
  }, [location.pathname]);

  const element = useRoutes([
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: "upload", element: <UploadPage /> },
        { path: "files", element: <MyFilesPage /> },
        { path: "files/:id", element: <FileDetailPage /> },
        { path: "verify", element: <VerifyPage /> },
        { path: "certificate/:id", element: <CertificatePage /> },
        { path: "global", element: <GlobalRegistryPage /> },
        { path: "profile/user", element: <WalletProfileViewPage /> },
        { path: "profile", element: <ProfilePage /> },
        { path: "admin", element: <AdminPage /> },
        { path: "explorer", element: <ExplorerPage /> }
      ]
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/verify/doc/:docId", element: <VerifyDocPage /> },
    { path: "/verify/hash/:hash", element: <CertificatePage mode="hash" /> },
    { path: "*", element: <NotFoundPage /> }
  ]);

  return element;
};

