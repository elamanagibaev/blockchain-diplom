import React from "react";

export const Spinner: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <div className="spinner-wrap" style={{ width: size, height: size }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 50 50"
        style={{
          width: "100%",
          height: "100%",
          animation: "spinner-rotate 0.8s linear infinite",
          transformOrigin: "center",
        }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="80 40"
          style={{ color: "var(--color-primary)" }}
        />
      </svg>
    </div>
  );
};
