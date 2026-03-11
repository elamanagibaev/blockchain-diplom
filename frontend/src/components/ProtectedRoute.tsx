import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./Spinner";

export const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Spinner size={40} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

