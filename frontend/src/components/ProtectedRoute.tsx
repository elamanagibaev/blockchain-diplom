import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./Spinner";

export const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Spinner size={40} />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (location.pathname === "/dashboard" && user.role !== "admin") {
    return <Navigate to="/profile" replace />;
  }
  if (location.pathname === "/files" && user.role !== "student") {
    return <Navigate to="/profile" replace />;
  }
  if (location.pathname === "/global" && user.role === "student") {
    return <Navigate to="/profile" replace />;
  }
  return children;
};
