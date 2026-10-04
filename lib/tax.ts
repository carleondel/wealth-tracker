import type { Income, Position, Snapshot, Trade } from "./types";

/**
 * Spanish IRPF view of the Journal: realized gains with FIFO (the method
 * Hacienda requires for homogeneous securities and crypto) and dividends,
 * per calendar year. Everything in EUR.
 *
 * Inputs are what the app knows, so some numbers are estimates and flagged:
 * - Shares held before the first logged trade form an "opening lot" whose
 *   cost is the average price obtained by undoing the logged buys, converted
 *   at the oldest snapshot's USD/EUR rate (no purchase date known).
 * - Without amount_eur, a trade's EUR value is price × shares × the USD/EUR
 *   rate of the closest snapshot on/before its date.
 * - Fees add to the acquisition cost and reduce the sale value.
 */

/** Savings base scale (estatal + autonómica general), IRPF 2025. */
export const SAVINGS_BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 6_000, rate: 0.19 },
  { upTo: 50_000, rate: 0.21 },
  { upTo: 200_000, rate: 0.23 },
  { upTo: 300_000, rate: 0.27 },
  { upTo: Infinity, rate: 0.3 },
];

export function savingsTax(base: number): number {
  let tax = 0;
  let prev = 0;
  for (const b of SAVINGS_BRACKETS) {
    if (base <= prev) break;
    tax += (Math.min(base, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return tax;
}

export interface TaxSale {
  tradeId: string;
  date: string;
  ticker: string;
  shares: number;
  proceedsEur: number;
  costEur: number;
  gainEur: number;
  /** Cost or proceeds partly estimated (see module doc). */
  estimated: boolean;
  /** Loss with a repurchase within 2 months: may not be deductible yet. */
  washSale: boolean;
  /** More shares sold than lots known: the excess has no cost basis. */
  uncovered: number;
}

export interface TaxYear {
  year: number;
  sales: TaxSale[];
  gainsEur: number;
  lossesEur: number;
  netGainEur: number;
  dividendsGrossEur: number;
  withholdingEur: number;
  /** Rough savings-base tax on max(0, net gain) + gross dividends, before withholding. */
  estimatedTaxEur: number;
}

interface Lot {
  shares: number;
  /** EUR cost per share, fees included. */
  unitCostEur: number;
  estimated: boolean;
}

const DAY = 86_400_000;
const isCrypto = (ticker: string, positions: Position[]) =>
  positions.find((p) => p.ticker === ticker)?.is_crypto ?? /-USD$/i.test(ticker);

function makeFx(snapshots: Snapshot[], fallback: number) {
  const pts = snapshots
    .map((s) => ({ ms: Date.parse(s.created_at), rate: Number(s.usd_eur_rate) }))
    .filter((p) => Number.isFinite(p.ms) && p.rate > 0)
    .sort((a, b) => a.ms - b.ms);
  return {
    oldest: pts[0]?.rate ?? fallback,
    at(date: string): number {
      const ms = Date.parse(`${date.slice(0, 10)}T23:59:59`);
      let rate = pts[0]?.rate ?? fallback;
      for (const p of pts) {
        if (p.ms > ms) break;
        rate = p.rate;
      }
      return rate;
    },
  };
}

export function getTaxReport(
  trades: Trade[],
  positions: Position[],
  income: Income[],
  snapshots: Snapshot[],
  usdEur: number,
): TaxYear[] {
  const fx = makeFx(snapshots, usdEur);
  const chrono = [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );
  const tickers = Array.from(new Set(chrono.map((t) => t.ticker)));
  const sales: TaxSale[] = [];

  for (const ticker of tickers) {
    const tt = chrono.filter((t) => t.ticker === ticker);
    const pos = positions.find((p) => p.ticker === ticker);

    // Rebuild the holding before the first logged trade by undoing them.
    let shares = Number(pos?.shares ?? 0);
    let avg = pos?.avg_price_usd != null ? Number(pos.avg_price_usd) : null;
    for (const t of [...tt].reverse()) {
      const before = shares - Number(t.shares);
      if (t.shares > 0 && t.price_usd != null && avg != null && before > 1e-12) {
        avg = (avg * shares - Number(t.price_usd) * Number(t.shares)) / before;
      }
      shares = before;
    }
    const lots: Lot[] = [];
    if (shares > 1e-12) {
      lots.push({
        shares,
        unitCostEur: avg != null && avg > 0 ? avg * fx.oldest : 0,
        estimated: true,
      });
    }

    for (const t of tt) {
      const n = Math.abs(Number(t.shares));
      const fee = Number(t.fee_eur ?? 0);
      const grossEur =
        t.amount_eur != null
          ? Number(t.amount_eur)
          : t.price_usd != null
            ? Number(t.price_usd) * n * fx.at(t.date)
            : null;
      const valueEstimated = t.amount_eur == null;
      if (t.shares > 0) {
        lots.push({
          shares: n,
          unitCostEur: grossEur != null ? (grossEur + fee) / n : 0,
          estimated: valueEstimated || grossEur == null,
        });
        continue;
      }

      let left = n;
      let cost = 0;
      let estimated = valueEstimated || grossEur == null;
      while (left > 1e-12 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.shares, left);
        cost += take * lot.unitCostEur;
        estimated ||= lot.estimated;
        lot.shares -= take;
        left -= take;
        if (lot.shares <= 1e-12) lots.shift();
      }
      const proceeds = (grossEur ?? 0) - fee;
      const gain = proceeds - cost;
      const saleMs = Date.parse(t.date);
      const washSale =
        gain < 0 &&
        !isCrypto(ticker, positions) &&
        tt.some((b) => b.shares > 0 && Math.abs(Date.parse(b.date) - saleMs) <= 61 * DAY && b.id !== t.id);
      sales.push({
        tradeId: t.id,
        date: t.date.slice(0, 10),
        ticker,
        shares: n,
        proceedsEur: proceeds,
        costEur: cost,
        gainEur: gain,
        estimated,
        washSale,
        uncovered: left > 1e-12 ? left : 0,
      });
    }
  }

  const years = new Set<number>([
    ...sales.map((s) => Number(s.date.slice(0, 4))),
    ...income.map((i) => Number(i.date.slice(0, 4))),
  ]);
  return Array.from(years)
    .sort((a, b) => b - a)
    .map((year) => {
      const ys = sales.filter((s) => s.date.startsWith(String(year))).sort((a, b) => b.date.localeCompare(a.date));
      const yi = income.filter((i) => i.date.startsWith(String(year)));
      const gainsEur = ys.filter((s) => s.gainEur > 0).reduce((a, s) => a + s.gainEur, 0);
      const lossesEur = ys.filter((s) => s.gainEur < 0).reduce((a, s) => a + s.gainEur, 0);
      const netGainEur = gainsEur + lossesEur;
      const dividendsGrossEur = yi.reduce((a, i) => a + Number(i.gross_eur), 0);
      const withholdingEur = yi.reduce((a, i) => a + Number(i.withholding_eur ?? 0), 0);
      return {
        year,
        sales: ys,
        gainsEur,
        lossesEur,
        netGainEur,
        dividendsGrossEur,
        withholdingEur,
        estimatedTaxEur: savingsTax(Math.max(0, netGainEur) + dividendsGrossEur),
      };
    });
}
