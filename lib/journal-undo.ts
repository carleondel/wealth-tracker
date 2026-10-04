import { findAssetByName, findPositionByTicker } from "./journal-ops";
import type { Contribution, Income, ManualAsset, Position, Snapshot, Trade } from "./types";

/**
 * Undoing a Journal entry. Rows carry no explicit links, so the counterpart
 * of each entry is found the same way the form created it:
 *  - buy/sell funded from an account → trade.funding is the account name;
 *  - funded with external money → a contribution with note
 *    "compra|venta <shares> <TICKER>", same date and amount;
 *  - external deposit/withdrawal → a contribution whose note is the account.
 *
 * A contribution that some snapshot already includes is not deleted but
 * cancelled with an opposite contribution dated today: the old snapshot keeps
 * its neutralised flow and the undo is neutralised too, so neither shows up
 * as market return. If no snapshot has seen it yet, it's simply deleted.
 */
export type UndoEffect =
  | { kind: "position"; id: string; ticker: string; deltaShares: number; avgPriceUsd?: number | null }
  | { kind: "asset"; id: string; name: string; deltaEur: number }
  | { kind: "delete_trade"; id: string }
  | { kind: "delete_contribution"; id: string }
  | { kind: "delete_income"; id: string }
  | { kind: "reverse_contribution"; of: Contribution };

export interface UndoPlan {
  title: string;
  effects: UndoEffect[];
  /** Human-readable lines, one per effect, for the confirmation card. */
  lines: string[];
  warnings: string[];
}

interface Ctx {
  positions: Position[];
  manualAssets: ManualAsset[];
  contributions: Contribution[];
  trades: Trade[];
  income: Income[];
  snapshots: Snapshot[];
}

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const num = (n: number) => Number(n.toFixed(8)).toString();

/** Cash that moved for a trade: a buy pays the fee on top, a sell nets it. */
function tradeCash(t: Trade): number | null {
  if (t.amount_eur == null) return null;
  const fee = Number(t.fee_eur ?? 0);
  return t.shares > 0 ? Number(t.amount_eur) + fee : Number(t.amount_eur) - fee;
}

function tradeNote(t: Trade): string {
  return `${t.shares > 0 ? "compra" : "venta"} ${num(Math.abs(t.shares))} ${t.ticker}`;
}

/** Contribution created together with an externally funded trade. */
function findTradeContribution(t: Trade, contributions: Contribution[]): Contribution | undefined {
  const note = tradeNote(t).toLowerCase();
  const cash = tradeCash(t);
  const amount = cash != null ? (t.shares > 0 ? 1 : -1) * cash : null;
  return contributions.find(
    (c) =>
      (c.note ?? "").toLowerCase() === note &&
      c.date.slice(0, 10) === t.date.slice(0, 10) &&
      (amount == null || Math.abs(Number(c.amount_eur) - amount) < 0.01),
  );
}

/** Trade that an externally funded "compra/venta …" contribution belongs to. */
function findContributionTrade(c: Contribution, trades: Trade[]): Trade | undefined {
  const note = (c.note ?? "").toLowerCase();
  if (!/^(compra|venta) /.test(note)) return undefined;
  return trades.find((t) => findTradeContribution(t, [c]) === c);
}

function seenBySnapshot(c: Contribution, snapshots: Snapshot[]): boolean {
  const ms = Date.parse(c.created_at);
  if (!Number.isFinite(ms)) return true;
  return snapshots.some((s) => Date.parse(s.created_at) > ms);
}

function contributionEffect(c: Contribution, ctx: Ctx, plan: UndoPlan) {
  if (seenBySnapshot(c, ctx.snapshots)) {
    plan.effects.push({ kind: "reverse_contribution", of: c });
    plan.lines.push(
      `Anotar ${Number(c.amount_eur) >= 0 ? "una retirada" : "una aportación"} de ${eur(Math.abs(Number(c.amount_eur)))} hoy que anula la original`,
    );
  } else {
    plan.effects.push({ kind: "delete_contribution", id: c.id });
    plan.lines.push(`Borrar la aportación de ${eur(Number(c.amount_eur))}`);
  }
}

export function planUndoTrade(t: Trade, ctx: Ctx): UndoPlan {
  const buy = t.shares > 0;
  const plan: UndoPlan = {
    title: `Deshacer ${buy ? "compra" : "venta"} de ${num(Math.abs(t.shares))} ${t.ticker}`,
    effects: [],
    lines: [],
    warnings: [],
  };

  const p = findPositionByTicker(ctx.positions, t.ticker);
  if (!p) {
    plan.warnings.push(`La posición ${t.ticker} ya no existe: no se tocan sus participaciones.`);
  } else {
    const shares = Number(p.shares);
    const after = shares - t.shares;
    let avg: number | null | undefined;
    // A buy with price moved the weighted average; invert that exact step.
    if (buy && t.price_usd != null && p.avg_price_usd != null && after > 1e-12) {
      avg = (Number(p.avg_price_usd) * shares - Number(t.price_usd) * t.shares) / after;
      if (!(avg > 0)) avg = undefined;
    }
    if (after < -1e-9) {
      plan.warnings.push(
        `${t.ticker} quedaría en ${num(after)}: ya has vendido parte de esas participaciones.`,
      );
    }
    plan.effects.push({ kind: "position", id: p.id, ticker: p.ticker, deltaShares: -t.shares, avgPriceUsd: avg });
    plan.lines.push(
      `${t.ticker}: ${num(shares)} → ${num(Math.max(after, 0))}${
        avg != null ? ` · precio medio vuelve a $${avg.toFixed(2)}` : ""
      }`,
    );
  }

  const amount = tradeCash(t);
  if (t.funding === "external") {
    const c = findTradeContribution(t, ctx.contributions);
    if (c) contributionEffect(c, ctx, plan);
    else plan.warnings.push("No encuentro la aportación que se registró con esta operación.");
  } else if (t.funding && amount != null) {
    const a = findAssetByName(ctx.manualAssets, t.funding);
    if (a) {
      const delta = buy ? amount : -amount;
      plan.effects.push({ kind: "asset", id: a.id, name: a.name, deltaEur: delta });
      plan.lines.push(`${a.name}: ${eur(Number(a.value_eur))} → ${eur(Number(a.value_eur) + delta)}`);
    } else {
      plan.warnings.push(`La cuenta "${t.funding}" ya no existe: ajusta su saldo a mano.`);
    }
  }

  plan.effects.push({ kind: "delete_trade", id: t.id });
  plan.lines.push("Borrar la operación del historial");
  return plan;
}

export function planUndoContribution(c: Contribution, ctx: Ctx): UndoPlan {
  const trade = findContributionTrade(c, ctx.trades);
  if (trade) {
    const plan = planUndoTrade(trade, ctx);
    plan.warnings.unshift("Esta aportación pagó una operación: se deshace la operación entera.");
    return plan;
  }

  const amount = Number(c.amount_eur);
  const plan: UndoPlan = {
    title: `Deshacer ${amount >= 0 ? "aportación" : "retirada"} de ${eur(Math.abs(amount))}`,
    effects: [],
    lines: [],
    warnings: [],
  };
  const a = c.note ? findAssetByName(ctx.manualAssets, c.note) : undefined;
  if (a) {
    plan.effects.push({ kind: "asset", id: a.id, name: a.name, deltaEur: -amount });
    plan.lines.push(`${a.name}: ${eur(Number(a.value_eur))} → ${eur(Number(a.value_eur) - amount)}`);
  } else {
    plan.warnings.push("No sé a qué cuenta fue este dinero: ajusta su saldo a mano si hace falta.");
  }
  contributionEffect(c, ctx, plan);
  return plan;
}

export function planUndoIncome(i: Income, ctx: Ctx): UndoPlan {
  const net = Number(i.gross_eur) - Number(i.withholding_eur ?? 0);
  const plan: UndoPlan = {
    title: `Deshacer dividendo de ${i.ticker} (${eur(net)})`,
    effects: [],
    lines: [],
    warnings: [],
  };
  const a = i.account ? findAssetByName(ctx.manualAssets, i.account) : undefined;
  if (a) {
    plan.effects.push({ kind: "asset", id: a.id, name: a.name, deltaEur: -net });
    plan.lines.push(`${a.name}: ${eur(Number(a.value_eur))} → ${eur(Number(a.value_eur) - net)}`);
  } else {
    plan.warnings.push(`La cuenta "${i.account ?? "?"}" ya no existe: ajusta su saldo a mano.`);
  }
  plan.effects.push({ kind: "delete_income", id: i.id });
  plan.lines.push("Borrar el dividendo del historial");
  return plan;
}
