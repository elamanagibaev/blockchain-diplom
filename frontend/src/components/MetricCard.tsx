import React from "react";

export type MetricCardProps = {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
};

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {icon && <div>{icon}</div>}
      <div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", textTransform: "uppercase" }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: color || "var(--color-text)" }}>{value}</div>
      </div>
    </div>
  );
};
