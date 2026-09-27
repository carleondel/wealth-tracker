import type { Contribution, ManualAsset, Position } from "./types";

/**
 * Operations built from the manual Journal form. The frontend shows them for
 * confirmation before anything hits the DB.
 */
export type JournalOp =
  | {
      type: "adjust_position";
      ticker: string;
      delta_shares: number;
      price_usd?: number | null;
    }
  | {
      type: "set_position";
      ticker: string;
      shares?: number | null;
      avg_price_usd?: number | null;
      target_price_usd?: number | null;
    }
  | {
      type: "adjust_asset";
      name: string;
      delta_eur: number;
    }
  | {
      type: "set_asset";
      name: string;
      value_eur: number;
    }
  | {
      type: "contribute";
      amount_eur: number;
      contribution_type: Contribution["type"];
      note?: string | null;
      date?: string | null;
    };

export function findPositionByTicker(
  positions: Position[],
  ticker: string,
): Position | undefined {
  return positions.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase());
}

export function findAssetByName(
  assets: ManualAsset[],
  name: string,
): ManualAsset | undefined {
  const norm = name.toLowerCase();
  return (
    assets.find((a) => a.name.toLowerCase() === norm) ??
    assets.find((a) => a.name.toLowerCase().includes(norm)) ??
    assets.find((a) => norm.includes(a.name.toLowerCase()))
  );
}

/**
 * Human-readable preview of what an op will do. Used in the confirmation UI.
 */
export function describeOp(
  op: JournalOp,
  positions: Position[],
  assets: ManualAsset[],
): string {
  switch (op.type) {
    case "adjust_position": {
      const p = findPositionByTicker(positions, op.ticker);
      const direction = op.delta_shares > 0 ? "compra" : "venta";
      const abs = Math.abs(op.delta_shares);
      const unit = positionUnit(p, op.ticker);
      const next = p ? p.shares + op.delta_shares : null;
      const priceSuffix = op.price_usd ? ` a $${op.price_usd}` : "";
      const missing = p ? "" : " (posición nueva, se creará)";
      return `${direction} ${abs} ${op.ticker}${priceSuffix}${missing}${next != null ? ` → queda ${round(next)} ${unit}` : ""}`;
    }
    case "set_position": {
      const p = findPositionByTicker(positions, op.ticker);
      const unit = positionUnit(p, op.ticker);
      const parts: string[] = [];
      if (op.shares != null) parts.push(`${unit}=${op.shares}`);
      if (op.avg_price_usd != null) parts.push(`avg=$${op.avg_price_usd}`);
      if (op.target_price_usd != null) parts.push(`target=$${op.target_price_usd}`);
      return `actualizar ${op.ticker} (${parts.join(", ")})`;
    }
    case "adjust_asset": {
      const a = findAssetByName(assets, op.name);
      const next = a ? a.value_eur + op.delta_eur : null;
      const sign = op.delta_eur >= 0 ? "+" : "";
      const missing = a ? "" : " (cuenta no encontrada)";
      return `${sign}€${round(op.delta_eur)} a ${a?.name ?? op.name}${missing}${
        next != null ? ` → €${round(next)}` : ""
      }`;
    }
    case "set_asset": {
      const a = findAssetByName(assets, op.name);
      const missing = a ? "" : " (cuenta no encontrada)";
      return `fijar ${a?.name ?? op.name}${missing} = €${round(op.value_eur)}`;
    }
    case "contribute": {
      const when = op.date ?? "hoy";
      const noteSuffix = op.note ? ` — ${op.note}` : "";
      return `aportación ${op.contribution_type} €${round(op.amount_eur)} (${when})${noteSuffix}`;
    }
  }
}

function round(n: number, digits = 2): string {
  return Number(n.toFixed(digits)).toString();
}

function positionUnit(p: Position | undefined, ticker: string): string {
  if (p?.is_crypto) return ticker.split("-")[0];
  return "shares";
}
