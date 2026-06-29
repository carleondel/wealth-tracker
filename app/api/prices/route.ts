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

async function fetchStockFinnhub(
  ticker: string,
  apiKey: string,
): Promise<{ price: number; change: number }> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    ticker,
  )}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const data = (await res.json()) as {
    c?: number; // current
    dp?: number; // daily percent change
    pc?: number; // previous close
  };
  const price = data.c;
  if (price == null || price === 0) throw new Error("Finnhub no price");
  const change = data.dp ?? 0;
  return { price, change };
}

async function fetchStocks(
  tickers: string[],
): Promise<{ prices: PriceMap; errors: string[] }> {
  const prices: PriceMap = {};
  const errors: string[] = [];
  if (tickers.length === 0) return { prices, errors };

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    errors.push(
      `FINNHUB_API_KEY not set — stock prices unavailable. Get a free key at https://finnhub.io and add it to your env vars.`,
    );
    return { prices, errors };
  }

  const results = await Promise.allSettled(
    tickers.map(async (t) => [t, await fetchStockFinnhub(t, apiKey)] as const),
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
    fetchStocks(stockTickers),
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
    if (!prices[t]) errors.push(`${t}: missing in Finnhub`);
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
