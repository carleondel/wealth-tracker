interface ProgressProps {
  value: number; // 0-100
  color?: string;
  className?: string;
}

export function Progress({
  value,
  color = "var(--accent)",
  className = "",
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)] ${className}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
