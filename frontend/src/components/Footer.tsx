import React from "react";
import { BRAND_FOOTER_TEXT } from "../constants/brand";

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>{BRAND_FOOTER_TEXT}</span>
      </div>
    </footer>
  );
};
