"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtEur } from "@/lib/format";
import { CATEGORY_COLORS, CATEGORY_TARGETS } from "@/lib/policy";
import {
  getCategoryBreakdown,
  getCategoryPercents,
  getTopConcentration,
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
}

export function AllocationTab({
  positions,
  manualAssets,
  prices,
  usdEur,
  btcUsd,
}: Props) {
  const [targets, setTargets] = useState(CATEGORY_TARGETS);
  const [simBtc, setSimBtc] = useState(prices["BTC-USD"]?.price ?? btcUsd);
  const [simMstr, setSimMstr] = useState(prices["MSTR"]?.price ?? 0);
  const [simFx, setSimFx] = useState(usdEur);

  const breakdown = useMemo(
    () => getCategoryBreakdown(positions, manualAssets, prices, usdEur),
    [positions, manualAssets, prices, usdEur],
  );
  const total = getTotalEur(breakdown);
  const percents = getCategoryPercents(breakdown);
  const top = getTopConcentration(positions, prices, usdEur, total, 5);

  const simPrices: PriceMap = useMemo(() => {
    const next: PriceMap = { ...prices };
    if (simBtc) next["BTC-USD"] = { price: simBtc, change: 0 };
    if (simMstr) next["MSTR"] = { price: simMstr, change: 0 };
    return next;
  }, [prices, simBtc, simMstr]);
  const simBreakdown = useMemo(
    () => getCategoryBreakdown(positions, manualAssets, simPrices, simFx),
    [positions, manualAssets, simPrices, simFx],
  );
  const simTotal = getTotalEur(simBreakdown);
  const delta = simTotal - total;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Asignación vs objetivo</CardTitle>
        <div className="mt-4 space-y-3">
          {(Object.keys(CATEGORY_TARGETS) as Category[]).map((cat) => {
            const current = percents[cat];
            const target = targets[cat];
            const dev = current - target;
            return (
              <div key={cat} className="flex items-center gap-3 text-xs">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: CATEGORY_COLORS[cat] }}
                />
                <span className="w-28 shrink-0 truncate">{cat}</span>
                <div className="flex-1 relative h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
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
                <span className="w-14 text-right tabular-nums">
                  {current.toFixed(1)}%
                </span>
                <label className="flex items-center gap-1 text-[var(--muted)]">
                  obj
                  <input
                    type="number"
                    value={target}
                    onChange={(e) =>
                      setTargets((prev) => ({
                        ...prev,
                        [cat]: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-12 bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-0.5 text-right tabular-nums"
                  />
                  %
                </label>
                <Badge variant={deviationVariant(dev)}>
                  {dev > 0 ? "+" : ""}
                  {dev.toFixed(1)}pp
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Top 5 concentración</CardTitle>
        <div className="mt-3 space-y-2 text-sm">
          {top.map(({ position, valueEur, pct }) => (
            <div key={position.id} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: CATEGORY_COLORS[position.category] }}
              />
              <span className="w-16 font-semibold">{position.ticker}</span>
              <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: CATEGORY_COLORS[position.category],
                  }}
                />
              </div>
              <span className="w-14 text-right tabular-nums">
                {pct.toFixed(1)}%
              </span>
              <span className="w-24 text-right tabular-nums text-[var(--muted)]">
                {fmtEur(valueEur)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Simulador de escenarios</CardTitle>
          <Badge variant={delta >= 0 ? "accent" : "danger"}>
            Δ {fmtEur(delta)}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Patrimonio simulado</span>
          <span className="text-xl font-semibold tabular-nums">
            {fmtEur(simTotal)}
          </span>
        </div>
      </Card>
    </div>
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
        <span className="uppercase tracking-wider text-[var(--muted)]">
          {label}
        </span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--accent)]"
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
