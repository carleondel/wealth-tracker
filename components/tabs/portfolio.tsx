"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Zap } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtEur, fmtPct, fmtUsd } from "@/lib/format";
import { CATEGORY_COLORS, CATEGORY_TARGETS, ROLE_INFO } from "@/lib/policy";
import {
  getAccruedInterest,
  getCategoryBreakdown,
  getCategoryPercents,
  getPnL,
  getPositionValueEur,
  getTotalEur,
} from "@/lib/calculations";
import type {
  Category,
  ManualAsset,
  Position,
  PriceMap,
} from "@/lib/types";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  prices: PriceMap;
  usdEur: number;
  btcUsd: number;
  totalEur: number;
  onAddPosition: () => void;
  onEditPosition: (p: Position) => void;
  onAddAsset: () => void;
  onEditAsset: (a: ManualAsset) => void;
}

const CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[];

export function PortfolioTab({
  positions,
  manualAssets,
  prices,
  usdEur,
  btcUsd,
  totalEur,
  onAddPosition,
  onEditPosition,
  onAddAsset,
  onEditAsset,
}: Props) {
  const groups = useMemo(
    () =>
      CATEGORIES.map((cat) => {
        const pos = positions
          .filter((p) => p.category === cat)
          .map((p) => ({ p, value: getPositionValueEur(p, prices, usdEur) }))
          .sort((a, b) => b.value - a.value);
        const assets = manualAssets
          .filter((a) => a.category === cat)
          .sort((a, b) => b.value_eur - a.value_eur);
        const total =
          pos.reduce((s, x) => s + x.value, 0) +
          assets.reduce((s, a) => s + a.value_eur, 0);
        return { cat, pos, assets, total };
      })
        .filter((g) => g.pos.length + g.assets.length > 0)
        .sort((a, b) => b.total - a.total),
    [positions, manualAssets, prices, usdEur],
  );

  const weight = (v: number) => (totalEur > 0 ? (v / totalEur) * 100 : 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <AllocationCard
        positions={positions}
        manualAssets={manualAssets}
        prices={prices}
        usdEur={usdEur}
      />

      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-xs uppercase tracking-widest text-[var(--muted)]">
            Posiciones ({positions.length + manualAssets.length})
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onAddPosition}>
              <Plus size={12} />
              Posición
            </Button>
            <Button variant="ghost" onClick={onAddAsset}>
              <Plus size={12} />
              Cuenta
            </Button>
          </div>
        </div>

        {groups.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">
            Sin posiciones. Añade una posición o una cuenta para empezar.
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="hidden sm:flex items-center gap-4 px-4 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <span className="flex-1">Activo</span>
              <span className="w-24 text-right">Precio</span>
              <span className="w-16 text-right">24h</span>
              <span className="w-16 text-right">P&L</span>
              <span className="w-14 text-right">Peso</span>
              <span className="w-24 text-right">Valor</span>
            </div>
            {groups.map((g) => (
              <div
                key={g.cat}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
              >
                <div className="flex items-center gap-2 sm:gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: CATEGORY_COLORS[g.cat] }}
                    />
                    <span className="text-xs uppercase tracking-wider truncate">
                      {g.cat}
                    </span>
                  </span>
                  <span className="sm:w-14 text-right text-xs tabular-nums text-[var(--muted)]">
                    {weight(g.total).toFixed(1)}%
                  </span>
                  <span className="text-xs tabular-nums font-semibold w-24 text-right">
                    {fmtEur(g.total)}
                  </span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {g.pos.map(({ p, value }) => (
                    <PositionRow
                      key={p.id}
                      position={p}
                      prices={prices}
                      valueEur={value}
                      weightPct={weight(value)}
                      onClick={() => onEditPosition(p)}
                    />
                  ))}
                  {g.assets.map((a) => (
                    <AssetRow
                      key={a.id}
                      asset={a}
                      weightPct={weight(a.value_eur)}
                      onClick={() => onEditAsset(a)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Simulator
        positions={positions}
        manualAssets={manualAssets}
        prices={prices}
        usdEur={usdEur}
        btcUsd={btcUsd}
      />
    </div>
  );
}

const rowClass =
  "w-full flex items-center gap-3 sm:gap-4 px-4 py-3 text-left hover:bg-[var(--surface-2)]/50 active:bg-[var(--surface-2)]/50 transition-colors";

function changeClass(v: number) {
  return v >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]";
}

function PositionRow({
  position,
  prices,
  valueEur,
  weightPct,
  onClick,
}: {
  position: Position;
  prices: PriceMap;
  valueEur: number;
  weightPct: number;
  onClick: () => void;
}) {
  const entry = prices[position.ticker];
  const pnl = getPnL(position, prices);
  const role = ROLE_INFO[position.role];
  const color = CATEGORY_COLORS[position.category];

  return (
    <button onClick={onClick} className={rowClass}>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span
          className="shrink-0 w-[4.5rem] text-center truncate px-1.5 py-0.5 rounded text-[11px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${color} 22%, transparent)`,
            color,
          }}
        >
          {position.ticker}
        </span>
        <div className="min-w-0">
          <div className="text-sm truncate">{position.name}</div>
          <div
            className="text-[10px] uppercase tracking-wider text-[var(--muted)] truncate"
            title={role.rule}
          >
            {role.label} · {position.platform}
            {position.target_price_usd != null
              ? ` · obj ${fmtUsd(position.target_price_usd, 0)}`
              : ""}
          </div>
        </div>
      </div>

      <span className="hidden sm:block w-24 text-right text-sm tabular-nums">
        {entry?.price != null ? fmtUsd(entry.price) : "—"}
      </span>
      <span
        className={`hidden sm:block w-16 text-right text-xs tabular-nums ${
          entry?.change != null ? changeClass(entry.change) : "text-[var(--muted)]"
        }`}
      >
        {entry?.change != null ? fmtPct(entry.change) : "—"}
      </span>
      <span
        className={`hidden sm:block w-16 text-right text-xs tabular-nums ${
          pnl ? changeClass(pnl.pct) : "text-[var(--muted)]"
        }`}
      >
        {pnl ? fmtPct(pnl.pct * 100, 1) : "—"}
      </span>
      <span className="hidden sm:block w-14 text-right text-xs tabular-nums text-[var(--muted)]">
        {weightPct.toFixed(1)}%
      </span>

      <div className="shrink-0 w-24 text-right">
        <div className="text-sm font-semibold tabular-nums">{fmtEur(valueEur)}</div>
        <div className="sm:hidden text-[11px] tabular-nums">
          {entry?.change != null ? (
            <span className={changeClass(entry.change)}>{fmtPct(entry.change, 1)}</span>
          ) : (
            <span className="text-[var(--muted)]">sin precio</span>
          )}
          <span className="text-[var(--muted)]"> · {weightPct.toFixed(1)}%</span>
        </div>
      </div>
    </button>
  );
}

function AssetRow({
  asset,
  weightPct,
  onClick,
}: {
  asset: ManualAsset;
  weightPct: number;
  onClick: () => void;
}) {
  const { accruedEur } = getAccruedInterest(asset);
  return (
    <button onClick={onClick} className={rowClass}>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="shrink-0 w-[4.5rem] text-center px-1.5 py-0.5 rounded text-[11px] text-[var(--muted)] border border-[var(--border)]">
          CUENTA
        </span>
        <div className="min-w-0">
          <div className="text-sm truncate">{asset.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] truncate">
            {asset.platform}
            {asset.rate_label ? ` · ${asset.rate_label}` : ""}
          </div>
        </div>
      </div>

      <span
        className="hidden sm:flex w-24 justify-end items-center gap-1 text-[11px] tabular-nums text-[var(--accent)]"
        title={accruedEur > 0.01 ? "Interés acumulado sin aplicar" : undefined}
      >
        {accruedEur > 0.01 ? (
          <>
            <Zap size={10} />+{fmtEur(accruedEur, 2)}
          </>
        ) : null}
      </span>
      <span className="hidden sm:block w-16" />
      <span className="hidden sm:block w-16" />
      <span className="hidden sm:block w-14 text-right text-xs tabular-nums text-[var(--muted)]">
        {weightPct.toFixed(1)}%
      </span>

      <div className="shrink-0 w-24 text-right">
        <div className="text-sm font-semibold tabular-nums">{fmtEur(asset.value_eur)}</div>
        <div className="sm:hidden text-[11px] tabular-nums text-[var(--muted)]">
          {accruedEur > 0.01 ? (
            <span className="text-[var(--accent)]">+{fmtEur(accruedEur, 2)} · </span>
          ) : null}
          {weightPct.toFixed(1)}%
        </div>
      </div>
    </button>
  );
}

function AllocationCard({
  positions,
  manualAssets,
  prices,
  usdEur,
}: {
  positions: Position[];
  manualAssets: ManualAsset[];
  prices: PriceMap;
  usdEur: number;
}) {
  const [targets, setTargets] = useState(CATEGORY_TARGETS);
  const percents = getCategoryPercents(
    getCategoryBreakdown(positions, manualAssets, prices, usdEur),
  );

  return (
    <Card>
      <CardTitle>Asignación vs objetivo</CardTitle>
      <div className="mt-4 space-y-4 sm:space-y-3">
        {CATEGORIES.map((cat) => {
          const current = percents[cat];
          const target = targets[cat];
          const dev = current - target;
          return (
            <div
              key={cat}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:flex items-center gap-x-2 sm:gap-x-3 gap-y-2 text-xs"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: CATEGORY_COLORS[cat] }}
              />
              <span className="min-w-0 sm:w-28 sm:shrink-0 truncate">{cat}</span>
              <span className="sm:order-1 sm:w-14 shrink-0 text-right tabular-nums font-semibold sm:font-normal">
                {current.toFixed(1)}%
              </span>
              <div className="col-span-3 sm:flex-1 relative h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(100, current)}%`,
                    background: CATEGORY_COLORS[cat],
                  }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-[var(--foreground)]/60"
                  style={{ left: `${Math.min(100, target)}%` }}
                />
              </div>
              <div className="col-span-3 sm:order-2 flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <label className="flex items-center gap-1 text-[var(--muted)]">
                  obj
                  <input
                    type="number"
                    inputMode="decimal"
                    value={target}
                    onChange={(e) =>
                      setTargets((prev) => ({
                        ...prev,
                        [cat]: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-14 sm:w-12 bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-0.5 text-right tabular-nums"
                  />
                  %
                </label>
                <span className="sm:w-[4.5rem] flex justify-end">
                  <Badge variant={deviationVariant(dev)}>
                    {dev > 0 ? "+" : ""}
                    {dev.toFixed(1)}pp
                  </Badge>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Simulator({
  positions,
  manualAssets,
  prices,
  usdEur,
  btcUsd,
}: {
  positions: Position[];
  manualAssets: ManualAsset[];
  prices: PriceMap;
  usdEur: number;
  btcUsd: number;
}) {
  const [simBtc, setSimBtc] = useState(prices["BTC-USD"]?.price ?? btcUsd);
  const [simMstr, setSimMstr] = useState(prices["MSTR"]?.price ?? 0);
  const [simFx, setSimFx] = useState(usdEur);

  const total = getTotalEur(
    getCategoryBreakdown(positions, manualAssets, prices, usdEur),
  );
  const simTotal = useMemo(() => {
    const next: PriceMap = { ...prices };
    if (simBtc) next["BTC-USD"] = { price: simBtc, change: 0 };
    if (simMstr) next["MSTR"] = { price: simMstr, change: 0 };
    return getTotalEur(getCategoryBreakdown(positions, manualAssets, next, simFx));
  }, [positions, manualAssets, prices, simBtc, simMstr, simFx]);
  const delta = simTotal - total;

  return (
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <CardTitle>Simulador de escenarios</CardTitle>
        <span className="flex items-center gap-2">
          <Badge variant={delta >= 0 ? "accent" : "danger"}>Δ {fmtEur(delta)}</Badge>
          <ChevronDown
            size={14}
            className="text-[var(--muted)] transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Slider
            label="BTC"
            min={40000}
            max={150000}
            step={1000}
            value={simBtc}
            onChange={setSimBtc}
            format={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Slider
            label="MSTR"
            min={100}
            max={500}
            step={5}
            value={simMstr}
            onChange={setSimMstr}
            format={(v) => `$${v.toFixed(0)}`}
          />
          <Slider
            label="USD/EUR"
            min={0.8}
            max={1}
            step={0.001}
            value={simFx}
            onChange={setSimFx}
            format={(v) => v.toFixed(3)}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--muted)]">Patrimonio simulado</span>
          <span className="text-xl font-semibold tabular-nums">{fmtEur(simTotal)}</span>
        </div>
      </div>
    </details>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider text-[var(--muted)]">{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-6 accent-[var(--accent)]"
      />
    </div>
  );
}

function deviationVariant(dev: number): "accent" | "warning" | "danger" {
  const abs = Math.abs(dev);
  if (abs < 3) return "accent";
  if (abs < 8) return "warning";
  return "danger";
}
