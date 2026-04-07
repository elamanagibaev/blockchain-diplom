import React from "react";

type Variant = "success" | "error" | "warning" | "info" | "neutral";

const map: Record<Variant, string> = {
  success: "ui-badge--success",
  error: "ui-badge--error",
  warning: "ui-badge--warning",
  info: "ui-badge--info",
  neutral: "ui-badge--neutral",
};

type Props = {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
};

export const Badge: React.FC<Props> = ({ variant = "neutral", children, className = "" }) => (
  <span className={`ui-badge ${map[variant]} ${className}`.trim()}>{children}</span>
);
