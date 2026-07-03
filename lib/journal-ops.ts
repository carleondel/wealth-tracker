import type { Contribution, ManualAsset, Position } from "./types";

/**
 * Operations the LLM can emit from a journal entry. The backend validates and
 * the frontend shows them for confirmation before anything hits the DB.
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

export interface JournalResponse {
  operations?: JournalOp[];
  raw?: string;
  error?: string;
}

const CONTRIBUTION_TYPES: Contribution["type"][] = [
  "liquidez",
  "inversion",
  "nomina",
  "otro",
];

/** Validate an unknown value as a JournalOp. Returns null if invalid. */
export function validateOp(candidate: unknown): JournalOp | null {
  if (!candidate || typeof candidate !== "object") return null;
  const o = candidate as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string") return null;

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  switch (type) {
    case "adjust_position": {
      const ticker = typeof o.ticker === "string" ? o.ticker.trim() : "";
      const delta = num(o.delta_shares);
      if (!ticker || delta === undefined || delta === 0) return null;
      return {
        type,
        ticker: ticker.toUpperCase(),
        delta_shares: delta,
        price_usd: num(o.price_usd) ?? null,
      };
    }
    case "set_position": {
      const ticker = typeof o.ticker === "string" ? o.ticker.trim() : "";
      if (!ticker) return null;
      const shares = num(o.shares);
      const avg = num(o.avg_price_usd);
      const target = num(o.target_price_usd);
      if (shares === undefined && avg === undefined && target === undefined) {
        return null;
      }
      return {
        type,
        ticker: ticker.toUpperCase(),
        shares: shares ?? null,
        avg_price_usd: avg ?? null,
        target_price_usd: target ?? null,
      };
    }
    case "adjust_asset": {
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const delta = num(o.delta_eur);
      if (!name || delta === undefined || delta === 0) return null;
      return { type, name, delta_eur: delta };
    }
    case "set_asset": {
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const value = num(o.value_eur);
      if (!name || value === undefined) return null;
      return { type, name, value_eur: value };
    }
    case "contribute": {
      const amount = num(o.amount_eur);
      if (amount === undefined || amount === 0) return null;
      const rawType = typeof o.contribution_type === "string"
        ? (o.contribution_type as Contribution["type"])
        : "otro";
      const ct = CONTRIBUTION_TYPES.includes(rawType) ? rawType : "otro";
      const note = typeof o.note === "string" && o.note.trim().length > 0
        ? o.note.trim()
        : null;
      const date = typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
        ? o.date
        : null;
      return { type, amount_eur: amount, contribution_type: ct, note, date };
    }
    default:
      return null;
  }
}

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
