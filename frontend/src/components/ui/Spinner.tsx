import React from "react";

type Props = {
  size?: number;
  className?: string;
};

export const Spinner: React.FC<Props> = ({ size = 24, className = "" }) => (
  <span
    className={`ui-spinner ${className}`.trim()}
    style={{ width: size, height: size, borderWidth: Math.max(2, size / 12) }}
    role="status"
    aria-label="Загрузка"
  />
);
