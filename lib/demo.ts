import type {
  Breakdown,
  Contribution,
  ManualAsset,
  Position,
  PriceMap,
  Snapshot,
} from "./types";
import { DEMO_MANUAL_ASSETS, DEMO_POSITIONS } from "./seed";

const DEMO_OWNER = "demo";

/**
 * Fictitious entry prices so /demo can show cumulative P&L. Demo-only: the
 * templates users seed from keep `avg_price_usd: null`, otherwise a fresh
 * account would start with made-up gains.
 */
const DEMO_AVG_PRICES: Record<string, number> = {
  "BTC-USD": 62000, MSTR: 280, B: 18, NEM: 42, UNH: 520, NVDA: 120,
  GOOGL: 150, AMZN: 180, TSLA: 240, MSFT: 410, META: 480,
  "USDC-USD": 1, "SOL-USD": 160, "XRP-USD": 0.6,
};
/** Extra demo target (on top of the template's) so both target states show. */
const DEMO_TARGETS: Record<string, number> = { NVDA: 220 };

export function makeDemoPositions(): Position[] {
  const now = new Date().toISOString();
  return DEMO_POSITIONS.map((p, i) => ({
    id: `demo-pos-${i}`,
    ticker: p.ticker,
    name: p.name,
    shares: p.shares,
    avg_price_usd: p.avg_price_usd ?? DEMO_AVG_PRICES[p.ticker] ?? null,
    category: p.category,
    platform: p.platform,
    role: p.role,
    target_price_usd: p.target_price_usd ?? DEMO_TARGETS[p.ticker] ?? null,
    is_crypto: p.is_crypto,
    created_at: now,
  }));
}

export function makeDemoManualAssets(): ManualAsset[] {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 10);
  return DEMO_MANUAL_ASSETS.map((a, i) => ({
    id: `demo-asset-${i}`,
    name: a.name,
    value_eur: a.value_eur,
    category: a.category,
    platform: a.platform,
    rate_label: a.rate_label,
    interest_rate_annual: a.interest_rate_annual,
    updated_at: baseDate.toISOString(),
  }));
}

export function makeDemoContributions(): Contribution[] {
  const today = new Date();
  const d = (daysAgo: number): string => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - daysAgo);
    return dt.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-c-1",
      amount_eur: 1200,
      type: "nomina",
      note: "nómina mensual",
      date: d(22),
      created_at: new Date(today.getTime() - 22 * 86_400_000).toISOString(),
    },
    {
      id: "demo-c-2",
      amount_eur: 200,
      type: "liquidez",
      note: "ahorro mensual",
      date: d(12),
      created_at: new Date(today.getTime() - 12 * 86_400_000).toISOString(),
    },
    {
      id: "demo-c-3",
      amount_eur: -500,
      type: "inversion",
      note: "compra adicional BTC",
      date: d(6),
      created_at: new Date(today.getTime() - 6 * 86_400_000).toISOString(),
    },
  ];
}

/**
 * Builds a plausible evolution chart: N past snapshots walking from ~85% of
 * the current total up to 100% with some sine-wave noise.
 */
export function generateDemoSnapshots(
  currentTotal: number,
  currentBreakdown: Breakdown,
  currentPrices: PriceMap,
  usdEur: number,
  btcUsd: number,
  days = 20,
): Snapshot[] {
  if (currentTotal <= 0) return [];
  const snapshots: Snapshot[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const progress = (days - i) / days;
    const trend = 0.85 + progress * 0.15;
    const noise = Math.sin(i * 0.8) * 0.017 + Math.cos(i * 1.3) * 0.009;
    const factor = trend + noise;
    const breakdown: Breakdown = {};
    for (const [k, v] of Object.entries(currentBreakdown)) {
      breakdown[k as keyof Breakdown] = (v ?? 0) * factor;
    }
    snapshots.push({
      id: `demo-snap-${i}`,
      total_eur: currentTotal * factor,
      breakdown,
      prices: currentPrices,
      usd_eur_rate: usdEur,
      btc_price_usd: btcUsd,
      created_at: date.toISOString(),
    });
  }
  // Newest first, matching how the real dashboard sorts
  return snapshots.reverse();
}

export const DEMO_USER_ID = DEMO_OWNER;
