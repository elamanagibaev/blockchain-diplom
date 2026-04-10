import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type EntityLinkProps = {
  href?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
};

/**
 * Кликабельный текст без «кнопочной» обводки; без href — обычный текст.
 */
export const EntityLink: React.FC<EntityLinkProps> = ({ href, children, className, title }) => {
  const base = "inline-block max-w-full truncate align-bottom text-sm";
  if (href) {
    return (
      <Link
        to={href}
        className={cn(base, "text-blue-600 hover:text-blue-800 hover:underline", className)}
        title={title}
      >
        {children}
      </Link>
    );
  }
  return (
    <span className={cn(base, "text-slate-800", className)} title={title}>
      {children}
    </span>
  );
};
