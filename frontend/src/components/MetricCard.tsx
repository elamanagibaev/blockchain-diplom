import React from "react";

export type MetricCardProps = {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
};

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="metric-card">
      {icon && <div className="metric-card-icon">{icon}</div>}
      <div className="metric-card-content">
        <div className="metric-card-label">{title}</div>
        <div className="metric-card-value" style={{ color: color || "var(--color-text)" }}>{value}</div>
      </div>
    </div>
  );
};
