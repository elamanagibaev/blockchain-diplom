import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className = "", id, ...rest },
  ref
) {
  const nid = id || rest.name;
  return (
    <div className="ui-input-wrap">
      {label && (
        <label className="ui-label" htmlFor={nid}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={nid}
        className={`ui-input ${error ? "ui-input--error" : ""} ${className}`.trim()}
        {...rest}
      />
      {error && <span className="ui-input-error">{error}</span>}
    </div>
  );
});
