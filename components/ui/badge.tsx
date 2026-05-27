import type { HTMLAttributes } from "react";

type Variant = "default" | "accent" | "warning" | "danger" | "muted";

const styles: Record<Variant, string> = {
  default: "bg-[var(--surface-2)] text-[var(--foreground)]",
  accent: "bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent)]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-[var(--warning)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_22%,transparent)] text-[var(--danger)]",
  muted: "bg-transparent text-[var(--muted)] border border-[var(--border)]",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
