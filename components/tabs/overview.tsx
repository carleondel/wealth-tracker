"use client";

import { useState } from "react";
import {
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtDate, fmtEur, fmtPct, fmtUsd } from "@/lib/format";
import { CATEGORY_COLORS, POLICY } from "@/lib/policy";
import {
  getActiveContributionRule,
  getLiquidityEur,
  getLiquidityMonths,
  getPnLForRange,
  getTargetProgress,
  type PnLRange,
} from "@/lib/calculations";
import type {
  Breakdown,
  Category,
  Contribution,
  Position,
  PriceMap,
  Snapshot,
} from "@/lib/types";

interface Props {
  breakdown: Breakdown;
  totalEur: number;
  prices: PriceMap;
  positions: Position[];
  snapshots: Snapshot[];
  contributions: Contribution[];
}

export function OverviewTab({
  breakdown,
  totalEur,
  prices,
  positions,
  snapshots,
  contributions,
}: Props) {
  const liquidity = getLiquidityEur(breakdown);
  const months = getLiquidityMonths(liquidity);
  const liquidityPct = Math.min(100, (liquidity / POLICY.liquidityTargetEur) * 100);

  const tacticalPositions = positions.filter(
    (p) => p.role === "tactica" && p.target_price_usd != null,
  );

  const rule = getActiveContributionRule(breakdown);

  const donutData = (Object.keys(CATEGORY_COLORS) as Category[])
    .map((cat) => ({
      name: cat,
      value: breakdown[cat] ?? 0,
      color: CATEGORY_COLORS[cat],
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-3">
        <PnLCard
          snapshots={snapshots}
          contributions={contributions}
          currentTotal={totalEur}
        />
      </div>

      <Card className="lg:col-span-2">
        <CardTitle>Distribución por categoría</CardTitle>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr,1fr] gap-6 items-center">
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      const { cx, cy } = viewBox as { cx: number; cy: number };
                      return (
                        <g>
                          <text
                            x={cx}
                            y={cy - 8}
                            textAnchor="middle"
                            className="fill-[var(--muted)]"
                            style={{
                              fontSize: 10,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            Total
                          </text>
                          <text
                            x={cx}
                            y={cy + 12}
                            textAnchor="middle"
                            className="fill-[var(--foreground)]"
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              fontFamily: "var(--font-mono)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {fmtEur(totalEur)}
                          </text>
                        </g>
                      );
                    }}
                  />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v) => fmtEur(Number(v) || 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-sm">
            {donutData.map((d) => {
              const pct = totalEur > 0 ? (d.value / totalEur) * 100 : 0;
              return (
                <li key={d.name} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: d.color }}
                  />
                  <span className="flex-1">{d.name}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="tabular-nums w-24 text-right">
                    {fmtEur(d.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Colchón de liquidez</CardTitle>
            <Badge variant={liquidity >= POLICY.liquidityTargetEur ? "accent" : "warning"}>
              {months.toFixed(1)} meses
            </Badge>
          </div>
          <div className="mt-3 text-2xl font-semibold">{fmtEur(liquidity)}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Objetivo {fmtEur(POLICY.liquidityTargetEur)} (~{(POLICY.liquidityTargetEur / POLICY.monthlyExpensesEur).toFixed(0)} meses a {fmtEur(POLICY.monthlyExpensesEur)}/mes)
          </div>
          <div className="mt-3">
            <Progress value={liquidityPct} />
          </div>
        </Card>

        {tacticalPositions.length > 0 ? (
          <Card>
            <CardTitle>Posiciones tácticas</CardTitle>
            <div className="mt-3 space-y-3">
              {tacticalPositions.map((p) => (
                <TacticalRow
                  key={p.id}
                  position={p}
                  currentPrice={prices[p.ticker]?.price}
                />
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="lg:col-span-3">
        <CardTitle>Regla de aportación activa</CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div>
            <div className="text-xs text-[var(--muted)]">Destino este mes</div>
            <div className="text-lg font-semibold capitalize mt-1">
              {rule.destination}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">Importe</div>
            <div className="text-lg font-semibold mt-1">
              {fmtEur(rule.amountEur)}
            </div>
          </div>
          <div className="flex-1 min-w-[200px] text-xs text-[var(--muted)]">
            {rule.reason}
          </div>
        </div>
      </Card>
    </div>
  );
}

const RANGES: PnLRange[] = ["1D", "7D", "30D", "90D", "YTD", "1Y", "ALL"];

function PnLCard({
  snapshots,
  contributions,
  currentTotal,
}: {
  snapshots: Snapshot[];
  contributions: Contribution[];
  currentTotal: number;
}) {
  const [range, setRange] = useState<PnLRange>("30D");

  if (snapshots.length < 2) {
    return (
      <Card>
        <CardTitle>P&L · mercado</CardTitle>
        <div className="mt-3 text-sm text-[var(--muted)]">
          Necesitas al menos 2 snapshots. Pulsa{" "}
          <strong className="text-[var(--foreground)]">Update</strong> en
          distintos momentos para acumular historia.
        </div>
      </Card>
    );
  }

  const result = getPnLForRange(snapshots, contributions, currentTotal, range);
  const positive = result ? result.marketDelta >= 0 : true;
  const color = positive ? "text-[var(--accent)]" : "text-[var(--danger)]";
  const sign = positive ? "+" : "";

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>P&L · mercado</CardTitle>
        <div className="flex gap-1 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded transition-colors ${
                range === r
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {result ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div className={`text-3xl font-semibold tabular-nums ${color}`}>
              {sign}
              {fmtEur(result.marketDelta)}
            </div>
            <div className={`text-base tabular-nums ${color}`}>
              {fmtPct(result.marketPct)}
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            desde {fmtDate(result.fromIso)} · neto{" "}
            <span className="tabular-nums">
              {result.netDelta >= 0 ? "+" : ""}
              {fmtEur(result.netDelta)}
            </span>
            {Math.abs(result.contributionsTotal) > 0.5 ? (
              <>
                {" "}
                (incluye{" "}
                <span className="tabular-nums">
                  {result.contributionsTotal >= 0 ? "+" : ""}
                  {fmtEur(result.contributionsTotal)}
                </span>{" "}
                aportaciones)
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-[var(--muted)]">
          Sin datos en este rango.
        </div>
      )}
    </Card>
  );
}

function TacticalRow({
  position,
  currentPrice,
}: {
  position: Position;
  currentPrice: number | undefined;
}) {
  const target = position.target_price_usd ?? 0;
  const progress = getTargetProgress(currentPrice, target);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{position.ticker}</span>
          <span className="text-[var(--muted)] text-xs truncate max-w-[120px]">
            {position.name}
          </span>
        </div>
        <Badge variant={progress.band === "exit" ? "accent" : "muted"}>
          {progress.band === "exit" ? "objetivo alcanzado" : "en progreso"}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs tabular-nums">
        <span className="font-semibold">
          {currentPrice != null ? fmtUsd(currentPrice) : "—"}
        </span>
        <span className="text-[var(--muted)]">
          → {fmtUsd(target, 0)} ({progress.remainingUsd > 0 ? `${fmtUsd(progress.remainingUsd, 0)} restantes` : "✓"})
        </span>
      </div>
      <div className="mt-2">
        <Progress value={progress.pct * 100} color="#FF6B35" />
      </div>
    </div>
  );
}
