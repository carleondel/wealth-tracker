import { CATEGORY_TARGETS, POLICY, SPECULATIVE_ROLES } from "./policy";
import type {
  Breakdown,
  Category,
  Contribution,
  ManualAsset,
  Position,
  PriceMap,
  Snapshot,
} from "./types";

/**
 * Value of a position in EUR given the current USD price and the USD/EUR rate.
 * Stablecoins (USDC, USDT) use price 1 when no price is provided.
 */
export function getPositionValueEur(
  position: Position,
  prices: PriceMap,
  usdEur: number,
): number {
  const entry = prices[position.ticker];
  const price = entry?.price ?? (isStablecoin(position.ticker) ? 1 : null);
  if (price === null) return 0;
  return position.shares * price * usdEur;
}

/**
 * P&L for a position relative to its average entry price. Returns null when
 * no avg_price is recorded.
 */
export function getPnL(
  position: Position,
  prices: PriceMap,
): { absUsd: number; pct: number } | null {
  if (position.avg_price_usd == null) return null;
  const entry = prices[position.ticker];
  const price = entry?.price;
  if (price == null) return null;
  const absUsd = (price - position.avg_price_usd) * position.shares;
  const pct = (price - position.avg_price_usd) / position.avg_price_usd;
  return { absUsd, pct };
}

/**
 * Aggregate EUR value per category across positions and manual assets.
 */
export function getCategoryBreakdown(
  positions: Position[],
  manualAssets: ManualAsset[],
  prices: PriceMap,
  usdEur: number,
): Breakdown {
  const breakdown: Breakdown = {};
  for (const p of positions) {
    const v = getPositionValueEur(p, prices, usdEur);
    breakdown[p.category] = (breakdown[p.category] ?? 0) + v;
  }
  for (const a of manualAssets) {
    breakdown[a.category] = (breakdown[a.category] ?? 0) + a.value_eur;
  }
  return breakdown;
}

export function getTotalEur(breakdown: Breakdown): number {
  return Object.values(breakdown).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/** Percent weight (0-100) of each category given a breakdown. */
export function getCategoryPercents(
  breakdown: Breakdown,
): Record<Category, number> {
  const total = getTotalEur(breakdown);
  const pct = {} as Record<Category, number>;
  for (const cat of Object.keys(CATEGORY_TARGETS) as Category[]) {
    pct[cat] = total > 0 ? ((breakdown[cat] ?? 0) / total) * 100 : 0;
  }
  return pct;
}

/** Absolute deviation (percentage points) vs target allocation. */
export function getDeviation(currentPct: number, targetPct: number): number {
  return currentPct - targetPct;
}

/** How many months of expenses the liquidity bucket covers. */
export function getLiquidityMonths(liquidityEur: number): number {
  return liquidityEur / POLICY.monthlyExpensesEur;
}

/** Liquidity EUR from a breakdown. */
export function getLiquidityEur(breakdown: Breakdown): number {
  return breakdown.Liquidez ?? 0;
}

/**
 * Which contribution rule is active today. When liquidity is below target, we
 * feed cash; otherwise contributions go to investment.
 */
export function getActiveContributionRule(breakdown: Breakdown): {
  destination: "liquidez" | "inversion";
  amountEur: number;
  reason: string;
} {
  const cash = getLiquidityEur(breakdown);
  if (cash < POLICY.liquidityTargetEur) {
    return {
      destination: "liquidez",
      amountEur: POLICY.monthlyContributionEur,
      reason: `Liquidez €${Math.round(cash)} < objetivo €${POLICY.liquidityTargetEur}`,
    };
  }
  return {
    destination: "inversion",
    amountEur: POLICY.monthlyContributionEur,
    reason: `Colchón completo (€${POLICY.liquidityTargetEur}) — aportar a inversión`,
  };
}

/** Progress of a position's price toward its exit target (generic). */
export function getTargetProgress(
  currentPriceUsd: number | undefined,
  targetPriceUsd: number,
): {
  pct: number;
  remainingUsd: number;
  band: "below" | "exit";
} {
  const price = currentPriceUsd ?? 0;
  const pct = targetPriceUsd > 0 ? Math.min(1, Math.max(0, price / targetPriceUsd)) : 0;
  const remainingUsd = Math.max(0, targetPriceUsd - price);
  const band: "below" | "exit" = price >= targetPriceUsd ? "exit" : "below";
  return { pct, remainingUsd, band };
}

export type Bucket = "long" | "spec";

export interface BucketStats {
  valueEur: number;
  /** Share of invested capital (cash excluded), 0-100. */
  weightPct: number;
  /** Unrealized % vs average cost over the positions that have one; null if none. */
  pnlPct: number | null;
  positions: number;
  /** Positions in the bucket without an average cost (left out of pnlPct). */
  withoutCost: number;
}

export interface StrategySplit {
  long: BucketStats;
  spec: BucketStats;
  investedEur: number;
  /** Cash left out of the split: manual assets + `caja` / Liquidez positions. */
  cashEur: number;
  /** Speculative position whose price is closest to its target (still below it). */
  nearestTarget: { ticker: string; toTargetPct: number } | null;
  /** Speculative positions already at or above their target. */
  targetsReached: string[];
}

export function getBucket(position: Position): Bucket | "cash" {
  if (position.role === "caja" || position.category === "Liquidez") return "cash";
  return SPECULATIVE_ROLES.has(position.role) ? "spec" : "long";
}

/**
 * Long-term vs speculative split of the invested money. Buckets come from the
 * position role (`SPECULATIVE_ROLES`); cash is reported apart so a big cash
 * pile doesn't make the speculative share look small.
 */
export function getStrategySplit(
  positions: Position[],
  manualAssets: ManualAsset[],
  prices: PriceMap,
  usdEur: number,
): StrategySplit {
  const acc = {
    long: { valueEur: 0, costUsd: 0, valueWithCostUsd: 0, positions: 0, withoutCost: 0 },
    spec: { valueEur: 0, costUsd: 0, valueWithCostUsd: 0, positions: 0, withoutCost: 0 },
  };
  let cashEur = manualAssets.reduce((s, a) => s + a.value_eur, 0);
  let nearestTarget: StrategySplit["nearestTarget"] = null;
  const targetsReached: string[] = [];

  for (const p of positions) {
    const valueEur = getPositionValueEur(p, prices, usdEur);
    const bucket = getBucket(p);
    if (bucket === "cash") {
      cashEur += valueEur;
      continue;
    }
    const b = acc[bucket];
    b.valueEur += valueEur;
    b.positions++;
    const price = prices[p.ticker]?.price;
    if (p.avg_price_usd != null && p.avg_price_usd > 0 && price != null) {
      b.costUsd += p.avg_price_usd * p.shares;
      b.valueWithCostUsd += price * p.shares;
    } else {
      b.withoutCost++;
    }
    if (bucket === "spec" && p.target_price_usd != null && price) {
      const toTargetPct = (p.target_price_usd / price - 1) * 100;
      if (toTargetPct <= 0) targetsReached.push(p.ticker);
      else if (!nearestTarget || toTargetPct < nearestTarget.toTargetPct)
        nearestTarget = { ticker: p.ticker, toTargetPct };
    }
  }

  const investedEur = acc.long.valueEur + acc.spec.valueEur;
  const stats = (b: (typeof acc)["long"]): BucketStats => ({
    valueEur: b.valueEur,
    weightPct: investedEur > 0 ? (b.valueEur / investedEur) * 100 : 0,
    pnlPct: b.costUsd > 0 ? (b.valueWithCostUsd / b.costUsd - 1) * 100 : null,
    positions: b.positions,
    withoutCost: b.withoutCost,
  });
  return {
    long: stats(acc.long),
    spec: stats(acc.spec),
    investedEur,
    cashEur,
    nearestTarget,
    targetsReached,
  };
}

const STABLES = new Set(["USDC-USD", "USDT-USD", "DAI-USD", "USDC", "USDT"]);
function isStablecoin(ticker: string): boolean {
  return STABLES.has(ticker.toUpperCase());
}

/**
 * Linear accrual of interest since the asset was last updated. Returns the
 * implied EUR amount accrued; NOT persisted to the DB until the user confirms.
 */
export function getAccruedInterest(
  asset: ManualAsset,
  now: Date = new Date(),
): { days: number; accruedEur: number } {
  if (!asset.interest_rate_annual || asset.interest_rate_annual <= 0) {
    return { days: 0, accruedEur: 0 };
  }
  const last = new Date(asset.updated_at).getTime();
  const ms = now.getTime() - last;
  const days = Math.max(0, ms / (1000 * 60 * 60 * 24));
  const accruedEur = (asset.value_eur * asset.interest_rate_annual * days) / 365;
  return { days, accruedEur };
}

export type PnLRange =
  | "1D"
  | "7D"
  | "MTD"
  | "30D"
  | "90D"
  | "YTD"
  | "1Y"
  | "2Y"
  | "ALL";

export interface PnLResult {
  baseline: number;
  /** Pure market move: net change minus contributions logged in the period. */
  marketDelta: number;
  marketPct: number;
  /** Net change in net worth (includes contributions). */
  netDelta: number;
  netPct: number;
  /** Sum of contributions logged with `date >= baseline date`. */
  contributionsTotal: number;
  fromIso: string;
}

/**
 * P&L for the given range. Returns both pure market performance (excluding
 * contributions logged in the period) and net change (including them).
 */
function findBaselineSnapshot(
  snapshots: Snapshot[],
  range: PnLRange,
  now: Date,
): Snapshot | null {
  if (snapshots.length === 0) return null;
  if (range === "ALL") {
    return snapshots.reduce((acc, s) =>
      new Date(s.created_at).getTime() < new Date(acc.created_at).getTime()
        ? s
        : acc,
    );
  }
  let targetMs: number;
  if (range === "YTD") {
    targetMs = new Date(now.getFullYear(), 0, 1).getTime();
  } else if (range === "MTD") {
    targetMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  } else {
    const days =
      { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365, "2Y": 730 }[range] ?? 0;
    targetMs = now.getTime() - days * 86_400_000;
  }
  let best: Snapshot | null = null;
  let bestDist = Infinity;
  for (const s of snapshots) {
    const t = new Date(s.created_at).getTime();
    const dist = Math.abs(t - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

/**
 * When a contribution entered the tracked net worth. The Journal writes the
 * contribution row together with the balance/position change, so `created_at`
 * is the moment snapshots start to include it. `date` is only the label the
 * user picked (it may be backdated), so it's a fallback for rows without one.
 */
function contributionMs(c: Contribution): number {
  const created = Date.parse(c.created_at);
  return Number.isFinite(created)
    ? created
    : new Date(`${c.date.slice(0, 10)}T00:00:00`).getTime();
}

/** Sum of contributions recorded in the interval (fromMs, toMs]. */
function sumContributions(contributions: Contribution[], fromMs: number, toMs: number): number {
  return contributions.reduce((sum, c) => {
    const ms = contributionMs(c);
    return ms > fromMs && ms <= toMs ? sum + (Number(c.amount_eur) || 0) : sum;
  }, 0);
}

export function getPnLForRange(
  snapshots: Snapshot[],
  contributions: Contribution[],
  currentTotal: number,
  range: PnLRange,
  now: Date = new Date(),
): PnLResult | null {
  if (snapshots.length === 0) return null;
  const baselineSnap = findBaselineSnapshot(snapshots, range, now);
  if (!baselineSnap) return null;

  const baseline = Number(baselineSnap.total_eur) || 0;
  const baselineMs = new Date(baselineSnap.created_at).getTime();
  const contributionsTotal = sumContributions(contributions, baselineMs, now.getTime());

  const netDelta = currentTotal - baseline;
  const marketDelta = netDelta - contributionsTotal;
  const netPct = baseline > 0 ? (netDelta / baseline) * 100 : 0;
  const marketPct = baseline > 0 ? (marketDelta / baseline) * 100 : 0;

  return {
    baseline,
    marketDelta,
    marketPct,
    netDelta,
    netPct,
    contributionsTotal,
    fromIso: baselineSnap.created_at,
  };
}

export interface HistoryPoint {
  createdAt: string;
  /** Absolute net worth EUR at this point. */
  value: number;
  /** Cumulative market % gain from the range's baseline (excludes contributions). */
  pct: number;
}

/**
 * Series for the history chart. Filters snapshots to the requested range and
 * computes both absolute value and cumulative pure-market percent for each
 * point (so the chart can toggle between "€" and "%" modes).
 */
export function getHistoryChartData(
  snapshots: Snapshot[],
  contributions: Contribution[],
  range: PnLRange,
  now: Date = new Date(),
): HistoryPoint[] {
  if (snapshots.length === 0) return [];
  const baselineSnap = findBaselineSnapshot(snapshots, range, now);
  if (!baselineSnap) return [];
  const baseline = Number(baselineSnap.total_eur) || 0;
  const baselineMs = new Date(baselineSnap.created_at).getTime();

  const inRange = snapshots
    .filter((s) => new Date(s.created_at).getTime() >= baselineMs)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  return inRange.map((s) => {
    const t = new Date(s.created_at).getTime();
    const contribsUpTo = sumContributions(contributions, baselineMs, t);
    const value = Number(s.total_eur) || 0;
    const marketDelta = value - baseline - contribsUpTo;
    const pct = baseline > 0 ? (marketDelta / baseline) * 100 : 0;
    return { createdAt: s.created_at, value, pct };
  });
}

/**
 * Today's EUR move across priced positions, derived from each ticker's 24h /
 * intraday % change. Manual assets don't move intraday.
 */
export function getDayChange(
  positions: Position[],
  prices: PriceMap,
  usdEur: number,
  totalEur: number,
): { eur: number; pct: number } | null {
  let eur = 0;
  let any = false;
  for (const p of positions) {
    const change = prices[p.ticker]?.change;
    if (change == null || change <= -100) continue;
    const value = getPositionValueEur(p, prices, usdEur);
    eur += value * (change / (100 + change));
    any = true;
  }
  if (!any) return null;
  const base = totalEur - eur;
  return { eur, pct: base > 0 ? (eur / base) * 100 : 0 };
}

/** Keeps only the latest snapshot of each local calendar day, oldest first. */
export function lastSnapshotPerDay(snapshots: Snapshot[]): Snapshot[] {
  const byDay = new Map<string, Snapshot>();
  for (const s of snapshots) {
    const key = new Date(s.created_at).toDateString();
    const prev = byDay.get(key);
    if (!prev || new Date(s.created_at) > new Date(prev.created_at)) byDay.set(key, s);
  }
  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export interface TwrPoint {
  createdAt: string;
  /** Cumulative time-weighted return (%) from the range baseline. */
  pct: number;
}

export interface TwrResult {
  points: TwrPoint[];
  /** Total TWR (%) over the range. */
  totalPct: number;
  fromIso: string;
  /** In the currency the TWR was computed in. */
  contributionsTotal: number;
}

/**
 * Time-weighted return: chains the sub-period returns between consecutive
 * snapshots, so the size and timing of contributions don't distort the %.
 *
 * Works at day granularity: only the last snapshot of each calendar day is
 * used. A contribution recorded between two snapshots is attached to the
 * later one and treated as arriving at the start of that sub-period:
 *   r = V_end / (V_start + flow) − 1
 * This matches the usual flow (buy during the day, snapshot that night).
 */
export function getTimeWeightedReturn(
  allSnapshots: Snapshot[],
  contributions: Contribution[],
  range: PnLRange,
  now: Date = new Date(),
  currency: "EUR" | "USD" = "EUR",
): TwrResult | null {
  // In USD every value is converted with its own snapshot's rate, so the
  // EUR/USD move becomes part of the return (what a dollar investor sees).
  // A flow is converted at the rate of the snapshot that first includes it.
  const fx = (s: Snapshot) => {
    const rate = Number(s.usd_eur_rate);
    return currency === "USD" && rate > 0 ? 1 / rate : 1;
  };
  const snapshots = lastSnapshotPerDay(allSnapshots);
  if (snapshots.length === 0) return null;
  const baselineSnap = findBaselineSnapshot(snapshots, range, now);
  if (!baselineSnap) return null;
  const baselineMs = new Date(baselineSnap.created_at).getTime();

  const inRange = snapshots
    .filter((s) => new Date(s.created_at).getTime() >= baselineMs)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  if (inRange.length === 0) return null;

  let index = 1;
  let contributionsTotal = 0;
  const points: TwrPoint[] = [{ createdAt: inRange[0].created_at, pct: 0 }];

  for (let i = 1; i < inRange.length; i++) {
    const prev = inRange[i - 1];
    const cur = inRange[i];
    const flow =
      sumContributions(
        contributions,
        new Date(prev.created_at).getTime(),
        new Date(cur.created_at).getTime(),
      ) * fx(cur);
    contributionsTotal += flow;
    const vStart = (Number(prev.total_eur) || 0) * fx(prev) + flow;
    const vEnd = (Number(cur.total_eur) || 0) * fx(cur);
    if (vStart > 0) index *= vEnd / vStart;
    points.push({ createdAt: cur.created_at, pct: (index - 1) * 100 });
  }

  return {
    points,
    totalPct: (index - 1) * 100,
    fromIso: baselineSnap.created_at,
    contributionsTotal,
  };
}
