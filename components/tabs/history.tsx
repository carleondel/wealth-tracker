"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtEur } from "@/lib/format";
import type { Contribution, Snapshot } from "@/lib/types";

interface Props {
  snapshots: Snapshot[];
  contributions: Contribution[];
  onAddContribution: (c: {
    amount_eur: number;
    type: Contribution["type"];
    note: string;
    date: string;
  }) => Promise<void>;
}

export function HistoryTab({
  snapshots,
  contributions,
  onAddContribution,
}: Props) {
  const chartData = [...snapshots]
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      }),
      total: Number(s.total_eur),
    }));

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<Contribution["type"]>("nomina");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return;
    setSaving(true);
    try {
      await onAddContribution({
        amount_eur: n,
        type,
        note: note.trim(),
        date,
      });
      setAmount("");
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Evolución del patrimonio</CardTitle>
          <Badge variant="muted">{snapshots.length} snapshots</Badge>
        </div>
        <div className="mt-4 h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
              Todavía no hay snapshots. Pulsa UPDATE para crear el primero.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
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
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v) => fmtEur(Number(v) || 0)}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--accent)"
                  fill="url(#grad)"
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

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr,1fr,2fr,auto] gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="uppercase tracking-wider text-[var(--muted)]">
              Importe (€)
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="200"
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="uppercase tracking-wider text-[var(--muted)]">
              Tipo
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Contribution["type"])}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="nomina">Nómina</option>
              <option value="liquidez">Liquidez</option>
              <option value="inversion">Inversión</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="uppercase tracking-wider text-[var(--muted)]">
              Nota
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="BBVA → Revolut"
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 flex-1">
              <span className="uppercase tracking-wider text-[var(--muted)]">
                Fecha
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 focus:outline-none focus:border-[var(--accent)]"
              />
            </label>
            <Button onClick={submit} disabled={saving || !amount}>
              {saving ? "…" : "Añadir"}
            </Button>
          </div>
        </div>

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
