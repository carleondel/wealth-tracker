/**
 * Benchmark series shared by `/api/benchmark` and the Benchmark tab.
 * Pure helpers only — no fetch here so the tab can import it.
 */

export interface BenchmarkPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Close in USD. */
  close: number;
}

export type BenchmarkId = "spx" | "btc";

export const BENCHMARKS: Record<BenchmarkId, { label: string; color: string }> = {
  spx: { label: "S&P 500", color: "#4A9EFF" },
  btc: { label: "Bitcoin", color: "#F7931A" },
};

export interface BenchmarkResult {
  series: Record<BenchmarkId, BenchmarkPoint[]>;
  /** USD→EUR by YYYY-MM-DD (ECB days only; weekends missing). */
  usdEur: Record<string, number>;
  errors: string[];
}

export type BenchmarkCurrency = "EUR" | "USD";

/** Last value on/before `date` in a date-sorted series (forward fill). */
function valueAt<T extends { date: string }>(
  sorted: T[],
  date: string,
  pick: (t: T) => number,
): number | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date <= date) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best >= 0 ? pick(sorted[best]) : null;
}

/**
 * Cumulative % return of a benchmark at each requested date, relative to the
 * first date. Optionally converted to EUR with the daily USD/EUR rate so it is
 * comparable with a EUR-denominated portfolio.
 */
export function benchmarkPctAt(
  points: BenchmarkPoint[],
  usdEur: Record<string, number>,
  dates: string[],
  currency: BenchmarkCurrency,
): Array<number | null> {
  if (points.length === 0 || dates.length === 0) return dates.map(() => null);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const fx = Object.entries(usdEur)
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const value = (date: string): number | null => {
    const close = valueAt(sorted, date, (p) => p.close);
    if (close == null) return null;
    if (currency === "USD") return close;
    const rate = valueAt(fx, date, (f) => f.rate);
    return rate == null ? null : close * rate;
  };

  const base = value(dates[0]);
  if (base == null || base <= 0) return dates.map(() => null);
  return dates.map((d) => {
    const v = value(d);
    return v == null ? null : (v / base - 1) * 100;
  });
}
