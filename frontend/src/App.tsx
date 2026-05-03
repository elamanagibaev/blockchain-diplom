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
import { DeanQueuePage } from "./pages/DeanQueuePage";
import { LandingPage } from "./pages/LandingPage";
import { DepartmentUsersPage } from "./pages/DepartmentUsersPage";
import { DepartmentGradesPage } from "./pages/DepartmentGradesPage";
import { BRAND_NAME } from "./constants/brand";
import { Footer } from "./components/Footer";

const NotFoundPage: React.FC = () => (
  <div className="flex min-h-screen flex-col bg-background bg-grid-pattern text-foreground">
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="gradient-card max-w-md rounded-2xl border border-border p-10 text-center shadow-elevated">
        <h1 className="mb-2 text-4xl font-bold text-primary">404</h1>
        <p className="mb-8 text-muted-foreground">Страница не найдена</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          На главную
        </Link>
      </div>
    </div>
    <Footer />
  </div>
);

export const App: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    const p = location.pathname;
    let page = "Платформа верификации документов";
    if (p === "/") page = "Главная";
    else if (p === "/dashboard") page = "Панель";
    else if (p.startsWith("/upload")) page = "Загрузка документа";
    else if (p.startsWith("/files")) page = "Документы";
    else if (p.startsWith("/global")) page = "Реестр";
    else if (p.startsWith("/verify/hash")) page = "Проверка по хэшу";
    else if (p.startsWith("/verify/doc")) page = "Публичная справка";
    else if (p.startsWith("/verify")) page = "Верификация";
    else if (p.startsWith("/admin")) page = "Админ-панель";
    else if (p.startsWith("/explorer")) page = "Журнал операций";
    else if (p.startsWith("/dean-queue")) page = "На согласование";
    else if (p.startsWith("/profile")) page = "Профиль";
    else if (p.startsWith("/login")) page = "Вход";
    else if (p.startsWith("/register")) page = "Регистрация";
    document.title = `${BRAND_NAME} - ${page}`;
  }, [location.pathname]);

  const element = useRoutes([
    { path: "/", element: <LandingPage /> },
    {
      element: <Layout />,
      children: [{ path: "/verify", element: <VerifyPage /> }]
    },
    {
      element: (
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      ),
      children: [
        { path: "/dashboard", element: <DashboardPage /> },
        { path: "/upload", element: <UploadPage /> },
        { path: "/files", element: <MyFilesPage /> },
        { path: "/files/:id", element: <FileDetailPage /> },
        { path: "/certificate/:id", element: <CertificatePage /> },
        { path: "/global", element: <GlobalRegistryPage /> },
        { path: "/profile/user", element: <WalletProfileViewPage /> },
        { path: "/profile", element: <ProfilePage /> },
        { path: "/admin", element: <AdminPage /> },
        { path: "/explorer", element: <ExplorerPage /> },
        { path: "/dean-queue", element: <DeanQueuePage /> },
        { path: "/department/users", element: <DepartmentUsersPage /> },
        { path: "/department/grades", element: <DepartmentGradesPage /> }
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

