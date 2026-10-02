import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchPrices } from "@/lib/prices-server";
import { getCategoryBreakdown, getTotalEur } from "@/lib/calculations";
import type { ManualAsset, Position, Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily snapshot for every user, triggered by Vercel Cron (see vercel.json).
 *
 * Uses the service role key because it has to read every user's positions
 * and write snapshots on their behalf — RLS is bypassed on purpose here, so
 * the route is protected by CRON_SECRET (Vercel sends it as a Bearer token).
 * Prices are fetched once for the union of all tickers.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 },
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [p, m] = await Promise.all([
    admin.from("positions").select("*"),
    admin.from("manual_assets").select("*"),
  ]);
  if (p.error) return NextResponse.json({ error: p.error.message }, { status: 500 });
  if (m.error) return NextResponse.json({ error: m.error.message }, { status: 500 });

  const positions = p.data as Array<Position & { owner_id: string }>;
  const assets = m.data as Array<ManualAsset & { owner_id: string }>;

  const owners = new Set<string>();
  for (const row of positions) owners.add(row.owner_id);
  for (const row of assets) owners.add(row.owner_id);
  if (owners.size === 0) {
    return NextResponse.json({ users: 0, saved: 0, errors: [] });
  }

  const tickers = Array.from(new Set(positions.map((x) => x.ticker)));
  const result = await fetchPrices(tickers);
  if (Object.keys(result.prices).length === 0) {
    return NextResponse.json(
      { error: "no prices returned", errors: result.errors },
      { status: 502 },
    );
  }

  const rows: Array<Omit<Snapshot, "id" | "created_at"> & { owner_id: string }> = [];
  for (const owner of owners) {
    const myPositions = positions.filter((x) => x.owner_id === owner);
    const myAssets = assets.filter((x) => x.owner_id === owner);
    // Only the prices this user holds, so the snapshot stays self-contained.
    const myPrices = Object.fromEntries(
      myPositions
        .map((x) => [x.ticker, result.prices[x.ticker]] as const)
        .filter(([, v]) => v != null),
    );
    const breakdown = getCategoryBreakdown(myPositions, myAssets, result.prices, result.usdEur);
    rows.push({
      owner_id: owner,
      total_eur: getTotalEur(breakdown),
      breakdown,
      prices: myPrices,
      usd_eur_rate: result.usdEur,
      btc_price_usd: result.btcUsd,
    });
  }

  const ins = await admin.from("snapshots").insert(rows);
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  return NextResponse.json({
    users: owners.size,
    saved: rows.length,
    tickers: tickers.length,
    errors: result.errors,
  });
}
