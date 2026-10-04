"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RANGES, RangePills } from "@/components/ui/range-pills";
import { usePersistentState } from "@/lib/use-persistent-state";
import { PushToggle } from "@/components/push-toggle";
import { fmtDate, fmtEur, fmtPct, fmtUsd } from "@/lib/format";
import { CATEGORY_COLORS, POLICY } from "@/lib/policy";
import {
  getActiveContributionRule,
  getHistoryChartData,
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
  /** User to save push subscriptions for; null hides the alerts toggle. */
  pushUserId: string | null;
}

export function OverviewTab({
  breakdown,
  totalEur,
  prices,
  positions,
  snapshots,
  contributions,
  pushUserId,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-3">
        <PerformanceCard
          snapshots={snapshots}
          contributions={contributions}
          currentTotal={totalEur}
        />
      </div>
      <DistributionCard breakdown={breakdown} totalEur={totalEur} />
      <div className="grid grid-cols-1 gap-4 content-start">
        <LiquidityCard breakdown={breakdown} />
        <PlanCard breakdown={breakdown} positions={positions} prices={prices} pushUserId={pushUserId} />
      </div>
    </div>
  );
}

type Mode = "value" | "pct";

function PerformanceCard({
  snapshots,
  contributions,
  currentTotal,
}: {
  snapshots: Snapshot[];
  contributions: Contribution[];
  currentTotal: number;
}) {
  const [range, setRange] = usePersistentState<PnLRange>("wt:overview:range", "30D", RANGES);
  const [mode, setMode] = usePersistentState<Mode>("wt:overview:mode", "value", ["value", "pct"]);

  const result = getPnLForRange(snapshots, contributions, currentTotal, range);
  const data = useMemo(
    () =>
      getHistoryChartData(snapshots, contributions, range).map((p) => ({
        date: new Date(p.createdAt).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        }),
        value: p.value,
        pct: p.pct,
      })),
    [snapshots, contributions, range],
  );

  const positive = result ? result.marketDelta >= 0 : true;
  const color = positive ? "text-[var(--accent)]" : "text-[var(--danger)]";

  const pctValues = data.map((d) => d.pct);
  const dataMin = pctValues.length ? Math.min(...pctValues) : 0;
  const dataMax = pctValues.length ? Math.max(...pctValues) : 0;
  const zeroOffset =
    dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);
  const stroke = positive ? "var(--accent)" : "var(--danger)";

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Rendimiento · mercado</CardTitle>
        <div className="inline-flex rounded border border-[var(--border)] overflow-hidden shrink-0">
          {(["value", "pct"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-[10px] uppercase tracking-wider ${
                m === "pct" ? "border-l border-[var(--border)]" : ""
              } ${
                mode === m
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {m === "value" ? "€" : "%"}
            </button>
          ))}
        </div>
      </div>

      {snapshots.length < 2 ? (
        <div className="mt-4 text-sm text-[var(--muted)]">
          Necesitas al menos 2 snapshots. Pulsa{" "}
          <strong className="text-[var(--foreground)]">Update</strong> en
          distintos momentos para acumular historia.
        </div>
      ) : (
        <>
          {result ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className={`text-3xl sm:text-4xl font-semibold tabular-nums ${color}`}>
                  {positive ? "+" : ""}
                  {fmtEur(result.marketDelta)}
                </div>
                <div className={`text-base sm:text-lg tabular-nums ${color}`}>
                  {fmtPct(result.marketPct)}
                </div>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                desde {fmtDate(result.fromIso)}
                {Math.abs(result.contributionsTotal) > 0.5 ? (
                  <>
                    {" "}· sin contar{" "}
                    <span className="tabular-nums">
                      {result.contributionsTotal >= 0 ? "+" : ""}
                      {fmtEur(result.contributionsTotal)}
                    </span>{" "}
                    de aportaciones
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 h-56 sm:h-80 -mx-2 sm:mx-0">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
                Sin datos en este rango.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-value" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-pct-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                      <stop offset={`${zeroOffset * 100}%`} stopColor="var(--accent)" stopOpacity={0} />
                      <stop offset={`${zeroOffset * 100}%`} stopColor="var(--danger)" stopOpacity={0} />
                      <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.45} />
                    </linearGradient>
                    <linearGradient id="grad-pct-stroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" />
                      <stop offset={`${zeroOffset * 100}%`} stopColor="var(--accent)" />
                      <stop offset={`${zeroOffset * 100}%`} stopColor="var(--danger)" />
                      <stop offset="100%" stopColor="var(--danger)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--muted)"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="var(--muted)"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) =>
                      mode === "value" ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(1)}%`
                    }
                  />
                  {mode === "pct" ? (
                    <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="2 2" strokeOpacity={0.5} />
                  ) : null}
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(v) =>
                      mode === "value" ? fmtEur(Number(v) || 0) : fmtPct(Number(v) || 0)
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={mode}
                    stroke={mode === "value" ? stroke : "url(#grad-pct-stroke)"}
                    fill={mode === "value" ? "url(#grad-value)" : "url(#grad-pct-fill)"}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <RangePills value={range} onChange={setRange} />
        </>
      )}
    </Card>
  );
}

function DistributionCard({
  breakdown,
  totalEur,
}: {
  breakdown: Breakdown;
  totalEur: number;
}) {
  const donutData = (Object.keys(CATEGORY_COLORS) as Category[])
    .map((cat) => ({
      name: cat,
      value: breakdown[cat] ?? 0,
      color: CATEGORY_COLORS[cat],
    }))
    .filter((d) => d.value > 0);

  return (
    <Card className="lg:col-span-2">
      <CardTitle>Distribución por categoría</CardTitle>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-center">
        <div className="h-48 sm:h-56 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
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
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: d.color }}
                />
                <span className="flex-1 min-w-0 truncate">{d.name}</span>
                <span className="tabular-nums text-[var(--muted)]">
                  {pct.toFixed(1)}%
                </span>
                <span className="tabular-nums w-20 sm:w-24 text-right">
                  {fmtEur(d.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function LiquidityCard({ breakdown }: { breakdown: Breakdown }) {
  const liquidity = getLiquidityEur(breakdown);
  const months = getLiquidityMonths(liquidity);
  const pct = Math.min(100, (liquidity / POLICY.liquidityTargetEur) * 100);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Colchón de liquidez</CardTitle>
        <Badge variant={liquidity >= POLICY.liquidityTargetEur ? "accent" : "warning"}>
          {months.toFixed(1)} meses
        </Badge>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{fmtEur(liquidity)}</div>
      <div className="mt-3">
        <Progress value={pct} />
      </div>
      <div className="mt-2 text-xs text-[var(--muted)]">
        Objetivo {fmtEur(POLICY.liquidityTargetEur)}
      </div>
    </Card>
  );
}

function PlanCard({
  breakdown,
  positions,
  prices,
  pushUserId,
}: {
  breakdown: Breakdown;
  positions: Position[];
  prices: PriceMap;
  pushUserId: string | null;
}) {
  const rule = getActiveContributionRule(breakdown);
  const withTarget = positions.filter((p) => p.target_price_usd != null);

  return (
    <Card>
      <CardTitle>Plan</CardTitle>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">Aportación del mes</span>
        <span className="text-sm font-semibold tabular-nums">
          {fmtEur(rule.amountEur)} → {rule.destination === "liquidez" ? "Liquidez" : "Inversión"}
        </span>
      </div>

      {withTarget.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Objetivos de precio
          </div>
          {withTarget.map((p) => {
            const current = prices[p.ticker]?.price;
            const target = p.target_price_usd ?? 0;
            const progress = getTargetProgress(current, target);
            const reached = progress.band === "exit";
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="font-semibold">{p.ticker}</span>
                  <span className={reached ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                    {current != null ? fmtUsd(current) : "—"} / {fmtUsd(target, 0)}
                    {reached ? " ✓" : ""}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Progress
                    value={progress.pct * 100}
                    color={reached ? "var(--accent)" : "#FF6B35"}
                  />
                </div>
              </div>
            );
          })}
          {pushUserId ? (
            <div className="pt-3 border-t border-[var(--border)]">
              <PushToggle userId={pushUserId} />
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
