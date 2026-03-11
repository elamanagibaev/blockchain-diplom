import React from "react";
import { Link } from "react-router-dom";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backTo?: { to: string; label: string };
};

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, backTo }) => {
  return (
    <div className="page-header">
      <div>
        {backTo && (
          <Link to={backTo.to} className="page-header-back">
            ← {backTo.label}
          </Link>
        )}
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <div className="muted page-header-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
};
