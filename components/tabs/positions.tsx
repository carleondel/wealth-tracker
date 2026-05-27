"use client";

import { Plus, Zap } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getAccruedInterest,
  getPnL,
  getPositionValueEur,
  sortByValueDesc,
} from "@/lib/calculations";
import { fmtEur, fmtPct, fmtUsd } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/policy";
import type { ManualAsset, Position, PriceMap } from "@/lib/types";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  prices: PriceMap;
  usdEur: number;
  totalEur: number;
  onAddPosition: () => void;
  onEditPosition: (p: Position) => void;
  onAddAsset: () => void;
  onEditAsset: (a: ManualAsset) => void;
}

export function PositionsTab({
  positions,
  manualAssets,
  prices,
  usdEur,
  totalEur,
  onAddPosition,
  onEditPosition,
  onAddAsset,
  onEditAsset,
}: Props) {
  const sorted = sortByValueDesc(positions, prices, usdEur);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-[var(--muted)]">
            Posiciones ({positions.length})
          </h2>
          <Button variant="ghost" onClick={onAddPosition}>
            <Plus size={12} />
            Añadir
          </Button>
        </div>
        {sorted.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">
            Sin posiciones. Click en "Añadir" para crear la primera.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sorted.map((p) => (
              <PositionCard
                key={p.id}
                position={p}
                prices={prices}
                usdEur={usdEur}
                totalEur={totalEur}
                onClick={() => onEditPosition(p)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-[var(--muted)]">
            Liquidez manual ({manualAssets.length})
          </h2>
          <Button variant="ghost" onClick={onAddAsset}>
            <Plus size={12} />
            Añadir
          </Button>
        </div>
        {manualAssets.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">
            Sin cuentas manuales. Click en "Añadir" para meter una (Revolut,
            BBVA, etc.).
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {manualAssets.map((a) => (
              <ManualAssetCard
                key={a.id}
                asset={a}
                totalEur={totalEur}
                onClick={() => onEditAsset(a)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PositionCard({
  position,
  prices,
  usdEur,
  totalEur,
  onClick,
}: {
  position: Position;
  prices: PriceMap;
  usdEur: number;
  totalEur: number;
  onClick: () => void;
}) {
  const entry = prices[position.ticker];
  const valueEur = getPositionValueEur(position, prices, usdEur);
  const pct = totalEur > 0 ? (valueEur / totalEur) * 100 : 0;
  const pnl = getPnL(position, prices);
  const hasTarget =
    position.target_price_usd != null && entry?.price != null;
  const remainingToTarget = hasTarget
    ? Math.max(0, (position.target_price_usd ?? 0) - (entry?.price ?? 0))
    : null;
  const targetReached = hasTarget && remainingToTarget === 0;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left hover:border-[var(--muted)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${CATEGORY_COLORS[position.category]} 22%, transparent)`,
              color: CATEGORY_COLORS[position.category],
            }}
          >
            {position.ticker}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{position.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              {roleLabel(position.role)} · {position.platform}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm tabular-nums">
            {entry?.price != null ? fmtUsd(entry.price) : "—"}
          </div>
          {entry?.change != null && entry.price != null ? (
            <div
              className={`text-[11px] tabular-nums ${
                entry.change >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
              }`}
            >
              {fmtPct(entry.change)}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">sin precio</div>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-[var(--muted)]">Valor</div>
          <div className="text-base font-semibold tabular-nums">
            {fmtEur(valueEur)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--muted)]">Peso</div>
          <div className="text-base tabular-nums">{pct.toFixed(1)}%</div>
        </div>
        {pnl ? (
          <div className="text-right">
            <div className="text-xs text-[var(--muted)]">P&L</div>
            <div
              className={`text-base tabular-nums ${
                pnl.pct >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
              }`}
            >
              {fmtPct(pnl.pct * 100)}
            </div>
          </div>
        ) : null}
      </div>

      <Progress value={pct} color={CATEGORY_COLORS[position.category]} />

      {hasTarget ? (
        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Objetivo {fmtUsd(position.target_price_usd ?? 0, 0)}</span>
          <Badge variant={targetReached ? "accent" : "warning"}>
            {targetReached
              ? "objetivo alcanzado"
              : `${fmtUsd(remainingToTarget ?? 0, 0)} restantes`}
          </Badge>
        </div>
      ) : null}
    </button>
  );
}

function ManualAssetCard({
  asset,
  totalEur,
  onClick,
}: {
  asset: ManualAsset;
  totalEur: number;
  onClick: () => void;
}) {
  const { accruedEur, days } = getAccruedInterest(asset);
  const hasAccrual = accruedEur > 0.01;
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left hover:border-[var(--muted)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{asset.name}</div>
          <div className="text-xs text-[var(--muted)]">
            {asset.platform}
            {asset.rate_label ? ` · ${asset.rate_label}` : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold tabular-nums">
            {fmtEur(asset.value_eur)}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {totalEur > 0
              ? `${((asset.value_eur / totalEur) * 100).toFixed(1)}%`
              : "—"}
          </div>
        </div>
      </div>

      {hasAccrual ? (
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border)]">
          <span className="flex items-center gap-1.5 text-[var(--muted)]">
            <Zap size={10} />
            {days.toFixed(0)}d al{" "}
            {(asset.interest_rate_annual * 100).toFixed(2)}%
          </span>
          <Badge variant="accent">+{fmtEur(accruedEur, 2)}</Badge>
        </div>
      ) : null}
    </button>
  );
}

function roleLabel(role: Position["role"]): string {
  const map: Record<Position["role"], string> = {
    core: "NÚCLEO",
    tactica: "TÁCTICA",
    cobertura: "COBERTURA",
    complemento: "COMPLEMENTO",
    caja: "CAJA",
    residual: "RESIDUAL",
  };
  return map[role];
}
