import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <div className="header">
        <div className="nav">
          <div className="navlinks">
            <strong>Blockchain File Registry</strong>
            <Link to="/">Dashboard</Link>
            <Link to="/upload">Upload</Link>
            <Link to="/files">My files</Link>
            <Link to="/verify">Verify</Link>
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
          </div>
          <div className="row">
            <span className="muted" style={{ color: "#cbd5e1" }}>
              {user?.email}
            </span>
            <button className="btn btn-danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <Outlet />
      </div>
    </>
  );
};

