import { NextResponse } from "next/server";
import { fetchPrices } from "@/lib/prices-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const param = url.searchParams.get("tickers") ?? "";
  const tickers = param.split(",").map((t) => t.trim()).filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "missing tickers" }, { status: 400 });
  }

  return NextResponse.json(await fetchPrices(tickers));
}
