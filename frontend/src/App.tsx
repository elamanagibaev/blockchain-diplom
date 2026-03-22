import React from "react";
import { Link, useRoutes } from "react-router-dom";
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

const NotFoundPage: React.FC = () => (
  <div className="page" style={{ textAlign: "center", paddingTop: 48 }}>
    <h1 style={{ marginBottom: 8 }}>404</h1>
    <p className="muted">Страница не найдена</p>
    <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>На главную</Link>
  </div>
);

export const App: React.FC = () => {
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
        { path: "admin", element: <AdminPage /> }
      ]
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/verify/hash/:hash", element: <CertificatePage mode="hash" /> },
    { path: "*", element: <NotFoundPage /> }
  ]);

  return element;
};

