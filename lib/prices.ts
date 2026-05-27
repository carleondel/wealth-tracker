import type { PriceMap, PricesResult } from "./types";

/**
 * Placeholder for an automated price feed. Returns whatever the caller passes
 * in so the rest of the app can treat "manual form submission" and "automated
 * fetch" identically. Swap the body later for a real API call.
 */
export async function fetchPrices(
  manual: PricesResult,
): Promise<PricesResult> {
  return manual;
}

/**
 * Parse a loose JSON blob from the UPDATE modal into a PricesResult.
 *
 * Accepted shapes (all keys case-insensitive, whitespace tolerated):
 *
 *   { "USD/EUR": 0.85, "BTC-USD": 77500, "MSTR": 164.2, ... }
 *   { "usdEur": 0.85, "btcUsd": 77500, "prices": { "MSTR": { "price": 164.2 } } }
 *
 * Values can be plain numbers (price only) or objects { price, change }.
 * Unknown keys are passed through so any ticker the user types is preserved.
 */
export function parsePricesJson(raw: string): Partial<PricesResult> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("JSON must be an object.");
  }

  const flat = parsed as Record<string, unknown>;

  // Shape 2: already-structured payload
  if ("prices" in flat && typeof flat.prices === "object") {
    return {
      usdEur: asNum(flat.usdEur) ?? asNum(flat["USD/EUR"]),
      btcUsd: asNum(flat.btcUsd) ?? asNum(flat["BTC-USD"]),
      prices: normalisePriceMap(flat.prices as Record<string, unknown>),
    };
  }

  // Shape 1: flat dictionary of tickers + special keys for FX / BTC
  const { usdEur, btcUsd, rest } = pluckSpecials(flat);
  return {
    usdEur,
    btcUsd,
    prices: normalisePriceMap(rest),
  };
}

function pluckSpecials(flat: Record<string, unknown>) {
  const rest: Record<string, unknown> = {};
  let usdEur: number | undefined;
  let btcUsd: number | undefined;

  for (const [key, value] of Object.entries(flat)) {
    const k = key.trim();
    const kl = k.toLowerCase();
    if (kl === "usd/eur" || kl === "usdeur" || kl === "usd_eur") {
      usdEur = asNum(value);
    } else if (kl === "btc-usd" || kl === "btcusd" || kl === "btc") {
      btcUsd = asNum(value);
      rest["BTC-USD"] = value;
    } else {
      rest[k] = value;
    }
  }
  return { usdEur, btcUsd, rest };
}

function normalisePriceMap(raw: Record<string, unknown>): PriceMap {
  const out: PriceMap = {};
  for (const [ticker, value] of Object.entries(raw)) {
    if (typeof value === "number") {
      out[ticker] = { price: value, change: 0 };
    } else if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      const price = asNum(v.price);
      if (price !== undefined) {
        out[ticker] = { price, change: asNum(v.change) ?? 0 };
      }
    }
  }
  return out;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
