import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>© {new Date().getFullYear()} ДипломЧейн</span>
        <span>Верификация документов с использованием блокчейна</span>
      </div>
    </footer>
  );
};
