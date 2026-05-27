"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtEur, fmtUsd } from "@/lib/format";
import { CATEGORY_COLORS, POLICY } from "@/lib/policy";
import {
  getActiveContributionRule,
  getLiquidityEur,
  getLiquidityMonths,
  getTargetProgress,
} from "@/lib/calculations";
import type {
  Breakdown,
  Category,
  Position,
  PriceMap,
} from "@/lib/types";

interface Props {
  breakdown: Breakdown;
  totalEur: number;
  prices: PriceMap;
  positions: Position[];
}

export function OverviewTab({ breakdown, totalEur, prices, positions }: Props) {
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
      <Card className="lg:col-span-2">
        <CardTitle>Distribución por categoría</CardTitle>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr,1fr] gap-6 items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
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
