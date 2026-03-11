import React from "react";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        {subtitle && <div className="muted" style={{ fontSize: 14 }}>{subtitle}</div>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
};
