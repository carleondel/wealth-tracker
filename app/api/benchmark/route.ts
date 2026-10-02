import { NextResponse } from "next/server";
import type { BenchmarkId, BenchmarkPoint, BenchmarkResult } from "@/lib/benchmark";

export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 3600;
const UA = "Mozilla/5.0 (compatible; wealth-tracker)";

/** Daily closes from Yahoo Finance's chart endpoint (no key). */
async function fetchYahoo(symbol: string, fromMs: number): Promise<BenchmarkPoint[]> {
  const period1 = Math.floor(fromMs / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
      error?: { description?: string } | null;
    };
  };
  const r = data.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  if (ts.length === 0) {
    throw new Error(`Yahoo ${symbol}: ${data.chart?.error?.description ?? "empty"}`);
  }
  const out: BenchmarkPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
  }
  return out;
}

/** Fallback for BTC: CoinGecko market_chart (max 365 days on the free tier). */
async function fetchCoinGeckoBtc(fromMs: number): Promise<BenchmarkPoint[]> {
  const days = Math.min(365, Math.max(1, Math.ceil((Date.now() - fromMs) / 86_400_000)));
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as { prices?: Array<[number, number]> };
  const byDay = new Map<string, number>();
  for (const [ms, price] of data.prices ?? []) {
    byDay.set(new Date(ms).toISOString().slice(0, 10), price);
  }
  return Array.from(byDay, ([date, close]) => ({ date, close }));
}

/** ECB USD→EUR daily reference rates for the window. */
async function fetchUsdEurSeries(fromIso: string): Promise<Record<string, number>> {
  const url = `https://api.frankfurter.dev/v1/${fromIso}..?from=USD&to=EUR`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, { EUR?: number }> };
  const out: Record<string, number> = {};
  for (const [date, r] of Object.entries(data.rates ?? {})) {
    if (r.EUR != null) out[date] = r.EUR;
  }
  return out;
}

/**
 * GET /api/benchmark?from=YYYY-MM-DD
 * Daily closes for the S&P 500 and BTC since `from` (a week of padding is
 * added so forward-fill has a value on the first day), plus USD/EUR rates.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "missing or invalid from" }, { status: 400 });
  }
  const fromMs = new Date(`${from}T00:00:00Z`).getTime() - 7 * 86_400_000;
  const paddedFrom = new Date(fromMs).toISOString().slice(0, 10);

  const errors: string[] = [];
  const series: Record<BenchmarkId, BenchmarkPoint[]> = { spx: [], btc: [] };

  const [spx, btc, fx] = await Promise.allSettled([
    fetchYahoo("^GSPC", fromMs),
    fetchYahoo("BTC-USD", fromMs).catch(() => fetchCoinGeckoBtc(fromMs)),
    fetchUsdEurSeries(paddedFrom),
  ]);

  if (spx.status === "fulfilled") series.spx = spx.value;
  else errors.push(`S&P 500: ${spx.reason instanceof Error ? spx.reason.message : "fail"}`);
  if (btc.status === "fulfilled") series.btc = btc.value;
  else errors.push(`BTC: ${btc.reason instanceof Error ? btc.reason.message : "fail"}`);

  let usdEur: Record<string, number> = {};
  if (fx.status === "fulfilled") usdEur = fx.value;
  else errors.push(`USD/EUR: ${fx.reason instanceof Error ? fx.reason.message : "fail"}`);

  const result: BenchmarkResult = { series, usdEur, errors };
  return NextResponse.json(result);
}
