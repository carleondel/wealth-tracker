import { NextResponse } from "next/server";
import type { PriceMap, PricesResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  "SOL-USD": "solana",
  "XRP-USD": "ripple",
  "USDC-USD": "usd-coin",
  "USDT-USD": "tether",
  "DOGE-USD": "dogecoin",
};

const STABLES = new Set(["USDC-USD", "USDT-USD", "DAI-USD"]);

async function fetchCrypto(tickers: string[]): Promise<PriceMap> {
  const out: PriceMap = {};
  const toFetch = tickers.filter((t) => COINGECKO_IDS[t]);
  if (toFetch.length === 0) return out;
  const ids = toFetch.map((t) => COINGECKO_IDS[t]).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    ids,
  )}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<
    string,
    { usd?: number; usd_24h_change?: number }
  >;
  for (const t of toFetch) {
    const id = COINGECKO_IDS[t];
    const entry = data[id];
    if (entry?.usd != null) {
      out[t] = {
        price: entry.usd,
        change: entry.usd_24h_change ?? 0,
      };
    }
  }
  return out;
}

async function fetchStockStooq(
  ticker: string,
): Promise<{ price: number; change: number }> {
  const sym = `${ticker.toLowerCase()}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    sym,
  )}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("Stooq empty");
  const header = lines[0].toLowerCase().split(",");
  const closeIdx = header.indexOf("close");
  const openIdx = header.indexOf("open");
  if (closeIdx === -1) throw new Error("Stooq header mismatch");
  const cols = lines[1].split(",");
  const closeRaw = cols[closeIdx];
  if (!closeRaw || closeRaw === "N/D") throw new Error("Stooq no data");
  const close = Number(closeRaw);
  if (!Number.isFinite(close) || close === 0) throw new Error("Stooq bad close");
  const open = Number(cols[openIdx]);
  const change =
    Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : 0;
  return { price: close, change };
}

async function fetchStocksStooq(
  tickers: string[],
): Promise<{ prices: PriceMap; errors: string[] }> {
  const prices: PriceMap = {};
  const errors: string[] = [];
  if (tickers.length === 0) return { prices, errors };
  const results = await Promise.allSettled(
    tickers.map(async (t) => [t, await fetchStockStooq(t)] as const),
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      const [t, data] = r.value;
      prices[t] = data;
    } else {
      errors.push(
        `stock ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      );
    }
  }
  return { prices, errors };
}

async function fetchUsdEur(): Promise<number> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = (await res.json()) as { rates?: { EUR?: number } };
  const rate = data.rates?.EUR;
  if (rate == null) throw new Error("Frankfurter missing EUR");
  return rate;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const param = url.searchParams.get("tickers") ?? "";
  const tickers = param.split(",").map((t) => t.trim()).filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "missing tickers" }, { status: 400 });
  }

  const cryptoTickers: string[] = [];
  const stockTickers: string[] = [];
  const stableTickers: string[] = [];

  for (const t of tickers) {
    if (STABLES.has(t)) stableTickers.push(t);
    else if (COINGECKO_IDS[t]) cryptoTickers.push(t);
    else stockTickers.push(t);
  }

  const errors: string[] = [];
  const prices: PriceMap = {};
  for (const t of stableTickers) prices[t] = { price: 1, change: 0 };

  const [cryptoRes, stockRes, fxRes] = await Promise.allSettled([
    fetchCrypto(cryptoTickers),
    fetchStocksStooq(stockTickers),
    fetchUsdEur(),
  ]);

  if (cryptoRes.status === "fulfilled") {
    Object.assign(prices, cryptoRes.value);
  } else {
    errors.push(`crypto: ${cryptoRes.reason?.message ?? "fail"}`);
  }
  if (stockRes.status === "fulfilled") {
    Object.assign(prices, stockRes.value.prices);
    errors.push(...stockRes.value.errors);
  } else {
    errors.push(`stocks: ${stockRes.reason?.message ?? "fail"}`);
  }

  for (const t of cryptoTickers) {
    if (!prices[t]) errors.push(`${t}: missing in CoinGecko`);
  }
  for (const t of stockTickers) {
    if (!prices[t]) errors.push(`${t}: missing in Stooq`);
  }

  let usdEur = 0.92;
  if (fxRes.status === "fulfilled") {
    usdEur = fxRes.value;
  } else {
    errors.push(`USD/EUR: ${fxRes.reason?.message ?? "fail"}`);
  }

  const btcUsd = prices["BTC-USD"]?.price ?? 0;

  const result: PricesResult & { errors: string[] } = {
    usdEur,
    btcUsd,
    prices,
    errors,
  };

  return NextResponse.json(result);
}
