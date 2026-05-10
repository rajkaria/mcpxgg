import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary:
        "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)] hover:shadow-[0_0_20px_rgba(129,140,248,0.3)] rounded-xl",
      secondary:
        "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] focus:ring-[var(--border)] rounded-xl",
      ghost:
        "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)] focus:ring-[var(--border)] rounded-xl",
      danger:
        "bg-[var(--error)] text-white hover:brightness-110 focus:ring-[var(--error)] rounded-xl",
    };

    const sizes = {
      sm: "text-sm px-4 py-2",
      md: "text-sm px-5 py-2.5",
      lg: "text-base px-8 py-3.5",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
