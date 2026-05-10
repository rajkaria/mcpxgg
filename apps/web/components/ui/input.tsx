import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-300 hover:border-[var(--border-hover)] ${
            error
              ? "border-[var(--error)]"
              : "border-[var(--border)]"
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
