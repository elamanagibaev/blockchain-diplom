import React from "react";

export const Spinner: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <div style={{ width: size, height: size, display: "inline-block" }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 50 50"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
