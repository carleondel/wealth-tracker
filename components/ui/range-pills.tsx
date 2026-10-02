import type { PnLRange } from "@/lib/calculations";

export const RANGES: PnLRange[] = ["1D", "7D", "MTD", "30D", "90D", "YTD", "1Y", "2Y", "ALL"];

export function rangeLabel(r: PnLRange): string {
  switch (r) {
    case "30D":
      return "1M";
    case "90D":
      return "3M";
    default:
      return r;
  }
}

const pill = (active: boolean) =>
  `shrink-0 px-1.5 py-1.5 sm:px-2 sm:py-1 text-[10px] uppercase tracking-wider rounded transition-colors ${
    active
      ? "bg-[var(--surface-2)] text-[var(--foreground)]"
      : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

export function RangePills({
  value,
  onChange,
  ranges = RANGES,
}: {
  value: PnLRange;
  onChange: (r: PnLRange) => void;
  ranges?: PnLRange[];
}) {
  return (
    <div className="mt-3 flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar justify-between sm:justify-center">
      {ranges.map((r) => (
        <button key={r} onClick={() => onChange(r)} className={pill(value === r)}>
          {rangeLabel(r)}
        </button>
      ))}
    </div>
  );
}
