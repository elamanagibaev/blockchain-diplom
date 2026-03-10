import React from "react";
import { useRoutes } from "react-router-dom";
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
        { path: "admin", element: <AdminPage /> }
      ]
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> }
  ]);

  return element;
};

