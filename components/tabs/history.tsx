"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { getHistoryChartData, type PnLRange } from "@/lib/calculations";
import type { Contribution, Snapshot } from "@/lib/types";

interface Props {
  snapshots: Snapshot[];
  contributions: Contribution[];
}

const RANGES: PnLRange[] = [
  "1D",
  "7D",
  "MTD",
  "30D",
  "90D",
  "YTD",
  "1Y",
  "2Y",
  "ALL",
];

function rangeLabel(r: PnLRange): string {
  switch (r) {
    case "30D":
      return "1M";
    case "90D":
      return "3M";
    default:
      return r;
  }
}

type Mode = "value" | "pct";

export function HistoryTab({ snapshots, contributions }: Props) {
  const [range, setRange] = useState<PnLRange>("30D");
  const [mode, setMode] = useState<Mode>("value");

  const data = useMemo(
    () => getHistoryChartData(snapshots, contributions, range),
    [snapshots, contributions, range],
  );

  const chartData = data.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    }),
    value: p.value,
    pct: p.pct,
  }));

  const lastPct = chartData.length > 0 ? chartData[chartData.length - 1].pct : 0;
  const trendPositive = lastPct >= 0;
  const trendColor = trendPositive ? "var(--accent)" : "var(--danger)";

  // Split-at-zero gradient offset for the performance chart.
  // If dataMax <= 0 → all red; dataMin >= 0 → all green; else interpolate.
  const pctValues = chartData.map((d) => d.pct);
  const dataMin = pctValues.length ? Math.min(...pctValues) : 0;
  const dataMax = pctValues.length ? Math.max(...pctValues) : 0;
  const zeroOffset =
    dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Evolución del patrimonio</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setMode("value")}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                  mode === "value"
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Valor
              </button>
              <button
                onClick={() => setMode("pct")}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border-l border-[var(--border)] ${
                  mode === "pct"
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Rendimiento
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
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
                  {rangeLabel(r)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === "pct" && chartData.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--muted)]">
            Rendimiento acumulado desde inicio del rango:{" "}
            <span
              className="tabular-nums"
              style={{ color: trendColor }}
            >
              {trendPositive ? "+" : ""}
              {fmtPct(lastPct)}
            </span>
          </div>
        ) : null}

        <div className="mt-4 h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
              Sin datos en este rango. Pulsa UPDATE para acumular historia.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad-value" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-pct-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                    <stop
                      offset={`${zeroOffset * 100}%`}
                      stopColor="var(--accent)"
                      stopOpacity={0}
                    />
                    <stop
                      offset={`${zeroOffset * 100}%`}
                      stopColor="var(--danger)"
                      stopOpacity={0}
                    />
                    <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="grad-pct-stroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset={`${zeroOffset * 100}%`} stopColor="var(--accent)" />
                    <stop offset={`${zeroOffset * 100}%`} stopColor="var(--danger)" />
                    <stop offset="100%" stopColor="var(--danger)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted)"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    mode === "value" ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(1)}%`
                  }
                />
                {mode === "pct" ? (
                  <ReferenceLine
                    y={0}
                    stroke="var(--muted)"
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                  />
                ) : null}
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v) =>
                    mode === "value"
                      ? fmtEur(Number(v) || 0)
                      : fmtPct(Number(v) || 0)
                  }
                />
                <Area
                  type="monotone"
                  dataKey={mode === "value" ? "value" : "pct"}
                  stroke={
                    mode === "value" ? "var(--accent)" : "url(#grad-pct-stroke)"
                  }
                  fill={
                    mode === "value" ? "url(#grad-value)" : "url(#grad-pct-fill)"
                  }
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Aportaciones</CardTitle>
          <Badge variant="muted">{contributions.length}</Badge>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Registro de dinero externo (nómina, ahorro nuevo…). Se añaden desde
          el <strong className="text-[var(--foreground)]">Journal</strong>.
        </p>

        <div className="mt-5 divide-y divide-[var(--border)]">
          {contributions.length === 0 ? (
            <div className="py-4 text-xs text-[var(--muted)]">
              Sin aportaciones registradas.
            </div>
          ) : (
            contributions.map((c) => (
              <div
                key={c.id}
                className="py-2 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="muted">{c.type}</Badge>
                  <span>{fmtDate(c.date)}</span>
                  {c.note ? (
                    <span className="text-[var(--muted)]">· {c.note}</span>
                  ) : null}
                </div>
                <span
                  className={`tabular-nums ${
                    c.amount_eur >= 0
                      ? "text-[var(--accent)]"
                      : "text-[var(--danger)]"
                  }`}
                >
                  {fmtEur(c.amount_eur)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
