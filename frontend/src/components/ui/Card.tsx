import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  padding?: "default" | "lg";
  style?: React.CSSProperties;
};

export const Card: React.FC<Props> = ({ children, className = "", padding = "default", style }) => (
  <div
    className={`ui-card ${padding === "lg" ? "ui-card--pad-lg" : ""} ${className}`.trim()}
    style={style}
  >
    {children}
  </div>
);
