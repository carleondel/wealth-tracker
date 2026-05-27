import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#052015] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--muted)]",
  danger:
    "bg-[color-mix(in_srgb,var(--danger)_22%,transparent)] text-[var(--danger)] hover:brightness-125",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider transition-colors ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
