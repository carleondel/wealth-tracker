import { CATEGORY_TARGETS, POLICY } from "./policy";
import type {
  Breakdown,
  Category,
  ManualAsset,
  Position,
  PriceMap,
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

/** Sort positions by current EUR value, DESC. */
export function sortByValueDesc(
  positions: Position[],
  prices: PriceMap,
  usdEur: number,
): Position[] {
  return [...positions].sort(
    (a, b) =>
      getPositionValueEur(b, prices, usdEur) -
      getPositionValueEur(a, prices, usdEur),
  );
}

/** Top-N concentration: returns positions sorted with their % of total. */
export function getTopConcentration(
  positions: Position[],
  prices: PriceMap,
  usdEur: number,
  totalEur: number,
  n = 5,
): Array<{ position: Position; valueEur: number; pct: number }> {
  return sortByValueDesc(positions, prices, usdEur)
    .slice(0, n)
    .map((position) => {
      const valueEur = getPositionValueEur(position, prices, usdEur);
      return {
        position,
        valueEur,
        pct: totalEur > 0 ? (valueEur / totalEur) * 100 : 0,
      };
    });
}
