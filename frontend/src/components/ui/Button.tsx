import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  ghost: "ui-btn--ghost",
  danger: "ui-btn--danger",
};

const sizeClass: Record<Size, string> = {
  sm: "ui-btn--sm",
  md: "ui-btn--md",
  lg: "ui-btn--lg",
};

export const Button: React.FC<Props> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}) => {
  const cls = ["ui-btn", variantClass[variant], sizeClass[size], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="ui-spinner" aria-hidden />}
      {children}
    </button>
  );
};
