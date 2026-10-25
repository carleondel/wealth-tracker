import type { Position, PriceMap } from "./types";

/** A missing quote must never turn a held position into a zero valuation. */
export function getSnapshotPriceErrors(
  positions: Pick<Position, "ticker" | "shares">[],
  prices: PriceMap,
  usdEur: number,
): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(usdEur) || usdEur <= 0) {
    errors.push("USD/EUR inválido");
  }
  const tickers = new Set(
    positions.filter((p) => p.shares !== 0).map((p) => p.ticker),
  );
  for (const ticker of tickers) {
    const price = prices[ticker]?.price;
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`${ticker}: falta una cotización válida`);
    }
  }
  return errors;
}
