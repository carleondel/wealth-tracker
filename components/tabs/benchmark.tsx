"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { RangePills } from "@/components/ui/range-pills";
import { fmtDate, fmtEur, fmtPct, fmtUsd } from "@/lib/format";
import {
  getTimeWeightedReturn,
  lastSnapshotPerDay,
  type PnLRange,
} from "@/lib/calculations";
import {
  BENCHMARKS,
  benchmarkPctAt,
  type BenchmarkCurrency,
  type BenchmarkId,
  type BenchmarkResult,
} from "@/lib/benchmark";
import type { Contribution, Snapshot } from "@/lib/types";

interface Props {
  snapshots: Snapshot[];
  contributions: Contribution[];
}

const PORTFOLIO_COLOR = "#52D9A4";
const IDS = Object.keys(BENCHMARKS) as BenchmarkId[];

export function BenchmarkTab({ snapshots, contributions }: Props) {
  const [range, setRange] = useState<PnLRange>("YTD");
  const [currency, setCurrency] = useState<BenchmarkCurrency>("EUR");
  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // One fetch per mount, from the oldest snapshot: every range is a slice of it.
  const oldestIso = useMemo(() => lastSnapshotPerDay(snapshots)[0]?.created_at ?? null, [snapshots]);
  const from = oldestIso ? oldestIso.slice(0, 10) : null;

  const loading = from != null && bench == null && err == null;

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    fetch(`/api/benchmark?from=${from}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as BenchmarkResult;
      })
      .then((data) => {
        if (cancelled) return;
        setBench(data);
        setErr(data.errors.length > 0 ? data.errors.join(" · ") : null);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [from]);

  const twr = useMemo(
    () => getTimeWeightedReturn(snapshots, contributions, range, new Date(), currency),
    [snapshots, contributions, range, currency],
  );

  const data = useMemo(() => {
    if (!twr) return [];
    const dates = twr.points.map((p) => p.createdAt.slice(0, 10));
    const benchPct = {} as Record<BenchmarkId, Array<number | null>>;
    for (const id of IDS) {
      benchPct[id] = bench
        ? benchmarkPctAt(bench.series[id], bench.usdEur, dates, currency)
        : dates.map(() => null);
    }
    return twr.points.map((p, i) => ({
      date: new Date(p.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      portfolio: p.pct,
      spx: benchPct.spx[i],
      btc: benchPct.btc[i],
    }));
  }, [twr, bench, currency]);

  const last = data[data.length - 1];
  const summary = twr
    ? [
        { id: "portfolio", label: "Mi cartera", color: PORTFOLIO_COLOR, pct: twr.totalPct },
        ...IDS.map((id) => {
          const pct = last?.[id] ?? null;
          return {
            id,
            label: BENCHMARKS[id].label,
            color: BENCHMARKS[id].color,
            pct,
            /** Mi cartera − benchmark, in percentage points. */
            gap: pct == null ? null : twr.totalPct - pct,
          };
        }),
      ]
    : [];

  if (snapshots.length < 2) {
    return (
      <Card>
        <CardTitle>Benchmark</CardTitle>
        <div className="mt-4 text-sm text-[var(--muted)]">
          Necesitas al menos 2 snapshots en días distintos. Con el snapshot
          diario automático la serie se llena sola; mientras tanto pulsa{" "}
          <strong className="text-[var(--foreground)]">Update</strong>.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Mi cartera vs mercado</CardTitle>
          <div className="inline-flex rounded border border-[var(--border)] overflow-hidden shrink-0">
            {(["EUR", "USD"] as BenchmarkCurrency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                title={
                  c === "EUR"
                    ? "Todo en €: índices convertidos con el tipo del BCE"
                    : "Todo en $: tu cartera convertida con el tipo de cada snapshot"
                }
                className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-[10px] uppercase tracking-wider ${
                  c === "USD" ? "border-l border-[var(--border)]" : ""
                } ${
                  currency === c
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {c === "EUR" ? "€" : "$"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
          {summary.map((s) => (
            <div key={s.id} className="min-w-0">
              <div className="flex items-start gap-1.5 text-[10px] uppercase tracking-normal sm:tracking-wider leading-tight text-[var(--muted)]">
                <span className="inline-block w-2 h-2 mt-px rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="min-w-0 break-words">{s.label}</span>
              </div>
              <div
                className={`mt-1 text-base min-[380px]:text-lg sm:text-2xl font-semibold tabular-nums whitespace-nowrap ${
                  s.pct == null
                    ? "text-[var(--muted)]"
                    : s.pct >= 0
                      ? "text-[var(--accent)]"
                      : "text-[var(--danger)]"
                }`}
              >
                {s.pct == null ? (loading ? "…" : "—") : fmtPct(s.pct, 1)}
              </div>
              {"gap" in s && s.gap != null ? (
                <div
                  className={`mt-0.5 text-[10px] sm:text-xs tabular-nums leading-tight ${
                    s.gap >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
                  }`}
                  title={`Rentabilidad de mi cartera menos la de ${s.label}`}
                >
                  {s.gap >= 0 ? "le sacas" : "te saca"}{" "}
                  <span className="whitespace-nowrap">{Math.abs(s.gap).toFixed(1)}%</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {twr ? (
          <div className="mt-3 text-[11px] sm:text-xs text-[var(--muted)]">
            desde {fmtDate(twr.fromIso)}
            {Math.abs(twr.contributionsTotal) > 0.5 ? (
              <>
                {" "}· sin contar{" "}
                <span className="tabular-nums whitespace-nowrap">
                  {twr.contributionsTotal >= 0 ? "+" : ""}
                  {currency === "USD" ? fmtUsd(twr.contributionsTotal, 0) : fmtEur(twr.contributionsTotal)}
                </span>{" "}
                de aportaciones
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 sm:mt-4 h-52 sm:h-80 -mx-2 sm:mx-0">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
              Sin datos en este rango.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
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
                  width={40}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="2 2" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v) => (v == null ? "—" : fmtPct(Number(v) || 0))}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Mi cartera"
                  stroke={PORTFOLIO_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {IDS.map((id) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={BENCHMARKS[id].label}
                    stroke={BENCHMARKS[id].color}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <RangePills value={range} onChange={setRange} />

        {err ? <div className="mt-3 text-xs text-[var(--danger)]">{err}</div> : null}
      </Card>

      <Card>
        <details className="group">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <CardTitle>Cómo se calcula</CardTitle>
            <ChevronDown size={14} className="text-[var(--muted)] transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs text-[var(--muted)] list-disc pl-4">
            <li>
              <strong className="text-[var(--foreground)]">Mi cartera</strong> es rendimiento{" "}
              <em>time-weighted</em> (TWR): se encadenan los tramos entre snapshots diarios y
              cada aportación se neutraliza en el tramo en el que la registras. Aportar más o
              menos no mueve el %; solo el mercado y los intereses.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">S&amp;P 500</strong> (índice ^GSPC) y{" "}
              <strong className="text-[var(--foreground)]">Bitcoin</strong> se comparan como si
              hubieras comprado y mantenido desde el inicio del rango.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">€ o $</strong>: todo se mide en la
              misma moneda. En € los índices se convierten con el tipo USD/EUR diario del BCE
              (lo que vería un inversor en euros); en $ es tu cartera la que se convierte, con
              el tipo de cada snapshot. La diferencia entre modos es lo que se ha movido el
              dólar frente al euro.
            </li>
            <li>
              Los benchmarks usan el cierre del día; la cartera, el último snapshot de cada
              día. Fines de semana y festivos se rellenan con el último valor disponible.
            </li>
          </ul>
        </details>
      </Card>
    </div>
  );
}
