import React from "react";

export type StatusBadgeProps = {
  status: string;
};

const statusColors: Record<string, string> = {
  REGISTERED: "--color-primary",
  "REGISTERED_ON_CHAIN": "--color-accent",
  VERIFIED: "--color-success",
  NOT_VERIFIED: "--color-danger",
  TRANSFERRED: "--color-accent",
  DRAFT: "#9ca3af",
  REJECTED: "--color-danger"
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const bg = statusColors[status] || "var(--color-muted)";
  return (
    <span
      style={{
        background: `var(${bg.replace(/--/g, "--")})`,
        color: "white",
        padding: "3px 8px",
        borderRadius: "8px",
        fontSize: "12px",
        textTransform: "uppercase"
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
};
