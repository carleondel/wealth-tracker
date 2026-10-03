"use client";

import { useState } from "react";
import { Check, Download, Trash2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManualOpForm } from "@/components/manual-op-form";
import { describeOp, type JournalOp } from "@/lib/journal-ops";
import { fmtDate, fmtEur, fmtNumber, fmtUsd } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Contribution, ManualAsset, Position, Trade } from "@/lib/types";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  contributions: Contribution[];
  trades: Trade[];
  usdEur: number;
  onApply: (ops: JournalOp[]) => Promise<{ applied: number; failed: string[] }>;
}

export function JournalTab({ positions, manualAssets, contributions, trades, usdEur, onApply }: Props) {
  const [ops, setOps] = useState<JournalOp[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; failed: string[] } | null>(null);

  function addOp(op: JournalOp) {
    setResult(null);
    setOps((prev) => {
      const idx = prev.length;
      setSelected((sel) => {
        const next = new Set(sel);
        next.add(idx);
        return next;
      });
      return [...prev, op];
    });
  }

  function clearOps() {
    setOps([]);
    setSelected(new Set());
    setResult(null);
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function apply() {
    const chosen = ops.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setApplying(true);
    setErr(null);
    try {
      const r = await onApply(chosen);
      setResult(r);
      if (r.failed.length === 0) {
        setOps([]);
        setSelected(new Set());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <ManualOpForm
        positions={positions}
        manualAssets={manualAssets}
        usdEur={usdEur}
        onAdd={addOp}
      />

      {err ? (
        <Card className="border-[var(--danger)]/60">
          <div className="text-sm text-[var(--danger)]">{err}</div>
        </Card>
      ) : null}

      {ops.length > 0 ? (
        <Card>
          <CardTitle>Operaciones pendientes ({ops.length})</CardTitle>
          <div className="mt-4 space-y-2">
            {ops.map((op, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                  selected.has(i)
                    ? "border-[var(--accent)]/60 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                    : "border-[var(--border)] bg-[var(--surface-2)]/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <div className="flex-1 min-w-0 text-sm break-words">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{opTypeLabel(op.type)}</Badge>
                  </div>
                  <div className="mt-1">{describeOp(op, positions, manualAssets)}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">
              {selected.size} de {ops.length} seleccionada(s)
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={clearOps} disabled={applying}>
                <Trash2 size={12} />
                Limpiar
              </Button>
              <Button onClick={apply} disabled={applying || selected.size === 0}>
                <Check size={12} />
                {applying ? "Aplicando…" : "Aplicar seleccionadas"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {result ? (
        <Card
          className={
            result.failed.length > 0
              ? "border-[var(--warning)]/60"
              : "border-[var(--accent)]/60"
          }
        >
          <div className="text-sm">
            Aplicadas: <strong>{result.applied}</strong>
            {result.failed.length > 0
              ? ` · Fallidas: ${result.failed.length}`
              : ""}
          </div>
          {result.failed.length > 0 ? (
            <ul className="mt-2 text-xs text-[var(--muted)] list-disc list-inside space-y-1">
              {result.failed.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <TradesCard trades={trades} />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="min-w-0">Aportaciones</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="muted">{contributions.length}</Badge>
            <ExportButton
              disabled={contributions.length === 0}
              onClick={() => exportContributions(contributions)}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Dinero externo (nómina, ahorro nuevo…). No cuenta como rendimiento.
        </p>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {contributions.length === 0 ? (
            <div className="py-3 text-xs text-[var(--muted)]">
              Sin aportaciones. Marca &quot;dinero externo&quot; al añadir un depósito.
            </div>
          ) : (
            contributions.map((c) => (
              <div key={c.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">{fmtDate(c.date)}</span>
                    <Badge variant="muted">{c.type}</Badge>
                  </div>
                  {c.note ? (
                    <div className="text-xs text-[var(--muted)] break-words">{c.note}</div>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 tabular-nums ${
                    c.amount_eur >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
                  }`}
                >
                  {c.amount_eur >= 0 ? "+" : ""}
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

function opTypeLabel(type: JournalOp["type"]): string {
  switch (type) {
    case "adjust_position":
      return "compra/venta";
    case "set_position":
      return "editar posición";
    case "adjust_asset":
      return "aportar/retirar";
    case "set_asset":
      return "fijar saldo";
    case "contribute":
      return "aportación";
  }
}

function TradesCard({ trades }: { trades: Trade[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="min-w-0">Historial de operaciones</CardTitle>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="muted">{trades.length}</Badge>
          <ExportButton disabled={trades.length === 0} onClick={() => exportTrades(trades)} />
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Compras y ventas aplicadas desde aquí. Las ventas con precio muestran el
        resultado realizado frente al coste medio.
      </p>
      <div className="mt-3 divide-y divide-[var(--border)]">
        {trades.length === 0 ? (
          <div className="py-3 text-xs text-[var(--muted)]">
            Sin operaciones registradas todavía.
          </div>
        ) : (
          trades.map((t) => {
            const buy = t.shares > 0;
            return (
              <div key={t.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap">{fmtDate(t.date)}</span>
                    <Badge variant={buy ? "accent" : "warning"}>{buy ? "compra" : "venta"}</Badge>
                    <span className="font-semibold">{t.ticker}</span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {fmtNumber(Math.abs(t.shares), 6)}
                      {t.price_usd != null ? ` × ${fmtUsd(t.price_usd)}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] break-words">
                    {t.funding === "external"
                      ? buy
                        ? "dinero externo"
                        : "sale de la cartera"
                      : t.funding
                        ? `${buy ? "desde" : "a"} ${t.funding}`
                        : "sin contrapartida"}
                    {t.realized_usd != null ? (
                      <>
                        {" "}·{" "}
                        <span className={t.realized_usd >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
                          {t.realized_usd >= 0 ? "+" : ""}
                          {fmtUsd(t.realized_usd)} realizado
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {t.amount_eur != null ? (
                  <span className="shrink-0 tabular-nums">
                    {buy ? "−" : "+"}
                    {fmtEur(t.amount_eur)}
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] disabled:opacity-40 disabled:cursor-not-allowed"
      title="Exportar CSV"
      aria-label="Exportar CSV"
    >
      <Download size={12} />
    </button>
  );
}

const stamp = () => new Date().toISOString().slice(0, 10);

function exportTrades(trades: Trade[]) {
  downloadCsv(
    `trades-${stamp()}.csv`,
    toCsv(trades, [
      { header: "date", value: (t) => t.date },
      { header: "side", value: (t) => (t.shares > 0 ? "buy" : "sell") },
      { header: "ticker", value: (t) => t.ticker },
      { header: "shares", value: (t) => Math.abs(t.shares) },
      { header: "price_usd", value: (t) => t.price_usd },
      { header: "amount_eur", value: (t) => t.amount_eur },
      { header: "funding", value: (t) => t.funding },
      { header: "realized_usd", value: (t) => t.realized_usd },
      { header: "note", value: (t) => t.note },
    ]),
  );
}

function exportContributions(contributions: Contribution[]) {
  downloadCsv(
    `contributions-${stamp()}.csv`,
    toCsv(contributions, [
      { header: "date", value: (c) => c.date },
      { header: "amount_eur", value: (c) => c.amount_eur },
      { header: "type", value: (c) => c.type },
      { header: "note", value: (c) => c.note },
    ]),
  );
}
