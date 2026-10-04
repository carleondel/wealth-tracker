"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Download, Trash2, Undo2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManualOpForm } from "@/components/manual-op-form";
import { describeOp, type JournalOp } from "@/lib/journal-ops";
import { fmtDate, fmtEur, fmtNumber, fmtUsd } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { getTaxReport, type TaxYear } from "@/lib/tax";
import { planUndoContribution, planUndoIncome, planUndoTrade, type UndoPlan } from "@/lib/journal-undo";
import type { Contribution, Income, ManualAsset, Position, Snapshot, Trade } from "@/lib/types";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  contributions: Contribution[];
  trades: Trade[];
  income: Income[];
  snapshots: Snapshot[];
  usdEur: number;
  onApply: (ops: JournalOp[]) => Promise<{ applied: number; failed: string[] }>;
  onUndo: (plan: UndoPlan) => Promise<void>;
}

export function JournalTab({
  positions,
  manualAssets,
  contributions,
  trades,
  income,
  snapshots,
  usdEur,
  onApply,
  onUndo,
}: Props) {
  const [undo, setUndo] = useState<UndoPlan | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoErr, setUndoErr] = useState<string | null>(null);
  const ctx = { positions, manualAssets, contributions, trades, income, snapshots };
  const taxYears = useMemo(
    () => getTaxReport(trades, positions, income, snapshots, usdEur),
    [trades, positions, income, snapshots, usdEur],
  );

  function askUndo(plan: UndoPlan) {
    setUndoErr(null);
    setUndo(plan);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmUndo() {
    if (!undo) return;
    setUndoing(true);
    setUndoErr(null);
    try {
      await onUndo(undo);
      setUndo(null);
    } catch (e) {
      setUndoErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUndoing(false);
    }
  }

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
      {undo ? (
        <Card className="border-[var(--warning)]/60">
          <CardTitle>{undo.title}</CardTitle>
          <ul className="mt-3 space-y-1 text-sm list-disc pl-4">
            {undo.lines.map((l, i) => (
              <li key={i} className="break-words">{l}</li>
            ))}
          </ul>
          {undo.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-[var(--warning)]">
              {undo.warnings.map((w, i) => (
                <li key={i} className="break-words">{w}</li>
              ))}
            </ul>
          ) : null}
          {undo.effects.some((e) => e.kind === "reverse_contribution") ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Ya hay snapshots con este dinero, así que en vez de borrar la aportación se anota
              otra en sentido contrario: así tu rentabilidad no da un salto.
            </p>
          ) : null}
          {undoErr ? <div className="mt-3 text-xs text-[var(--danger)]">{undoErr}</div> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUndo(null)} disabled={undoing}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmUndo} disabled={undoing}>
              <Undo2 size={12} />
              {undoing ? "Deshaciendo…" : "Deshacer"}
            </Button>
          </div>
        </Card>
      ) : null}

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

      <TradesCard trades={trades} onUndo={(t) => askUndo(planUndoTrade(t, ctx))} />

      <IncomeCard income={income} onUndo={(i) => askUndo(planUndoIncome(i, ctx))} />

      <TaxCard years={taxYears} />

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
                <UndoButton onClick={() => askUndo(planUndoContribution(c, ctx))} />
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
    case "income":
      return "dividendo";
  }
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 -my-1 -mr-2 p-2 text-[var(--muted)] hover:text-[var(--danger)]"
      title="Deshacer"
      aria-label="Deshacer"
    >
      <Trash2 size={13} />
    </button>
  );
}

function TradesCard({ trades, onUndo }: { trades: Trade[]; onUndo: (t: Trade) => void }) {
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
                    {t.fee_eur ? <> · comisión {fmtEur(Number(t.fee_eur), 2)}</> : null}
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
                <UndoButton onClick={() => onUndo(t)} />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function IncomeCard({ income, onUndo }: { income: Income[]; onUndo: (i: Income) => void }) {
  const year = new Date().getFullYear();
  const thisYear = income.filter((i) => i.date.startsWith(String(year)));
  const netYear = thisYear.reduce((s, i) => s + Number(i.gross_eur) - Number(i.withholding_eur ?? 0), 0);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="min-w-0">Dividendos</CardTitle>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="muted">{income.length}</Badge>
          <ExportButton disabled={income.length === 0} onClick={() => exportIncome(income)} />
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Cuentan como rendimiento.
        {thisYear.length > 0 ? (
          <>
            {" "}En {year}: <span className="text-[var(--accent)] tabular-nums">{fmtEur(netYear, 2)}</span> netos.
          </>
        ) : null}
      </p>
      <div className="mt-3 divide-y divide-[var(--border)]">
        {income.length === 0 ? (
          <div className="py-3 text-xs text-[var(--muted)]">
            Sin dividendos. Añádelos con &quot;Dividendo&quot; arriba.
          </div>
        ) : (
          income.map((i) => {
            const wh = Number(i.withholding_eur ?? 0);
            return (
              <div key={i.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap">{fmtDate(i.date)}</span>
                    <span className="font-semibold">{i.ticker}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] break-words">
                    {i.account ? `a ${i.account}` : "sin cuenta"}
                    {wh > 0 ? ` · bruto ${fmtEur(Number(i.gross_eur), 2)} − retención ${fmtEur(wh, 2)}` : ""}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-[var(--accent)]">
                  +{fmtEur(Number(i.gross_eur) - wh, 2)}
                </span>
                <UndoButton onClick={() => onUndo(i)} />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function TaxCard({ years }: { years: TaxYear[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const y = years.find((x) => x.year === picked) ?? years[0];
  const row = (label: string, v: number, cls = "") => (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`tabular-nums ${cls}`}>{fmtEur(v, 2)}</span>
    </div>
  );
  return (
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <CardTitle>Resumen fiscal (FIFO)</CardTitle>
        <span className="flex items-center gap-2">
          {y ? (
            <Badge variant={y.netGainEur >= 0 ? "accent" : "danger"} className="whitespace-nowrap">
              {y.year}: {fmtEur(y.netGainEur)}
            </Badge>
          ) : null}
          <ChevronDown size={14} className="text-[var(--muted)] transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-sm">
        {!y ? (
          <p className="text-xs text-[var(--muted)]">
            Sin ventas ni dividendos registrados todavía.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {years.map((x) => (
                  <button
                    key={x.year}
                    onClick={() => setPicked(x.year)}
                    className={`shrink-0 px-2 py-1 text-[10px] uppercase tracking-wider rounded ${
                      x.year === y.year
                        ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {x.year}
                  </button>
                ))}
              </div>
              <ExportButton disabled={y.sales.length === 0} onClick={() => exportTax(y)} />
            </div>

            <div className="mt-3 space-y-1.5 text-xs">
              {row("Ganancias", y.gainsEur, "text-[var(--accent)]")}
              {row("Pérdidas", y.lossesEur, "text-[var(--danger)]")}
              {row("Ganancia neta (transmisiones)", y.netGainEur, "font-semibold")}
              {row("Dividendos brutos", y.dividendsGrossEur)}
              {row("Retenciones ya pagadas", y.withholdingEur)}
              <div className="pt-1.5 border-t border-[var(--border)]">
                {row("Cuota orientativa base del ahorro", y.estimatedTaxEur, "font-semibold")}
                {row("Pendiente tras retenciones", Math.max(0, y.estimatedTaxEur - y.withholdingEur))}
              </div>
            </div>

            {y.sales.length > 0 ? (
              <div className="mt-4 divide-y divide-[var(--border)]">
                {y.sales.map((s) => (
                  <div key={s.tradeId} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs">
                      <div className="text-sm">
                        <span className="font-semibold">{s.ticker}</span>{" "}
                        <span className="text-[var(--muted)]">
                          {fmtNumber(s.shares, 6)} · {fmtDate(s.date)}
                        </span>
                      </div>
                      <div className="text-[var(--muted)] tabular-nums break-words">
                        venta {fmtEur(s.proceedsEur, 2)} − coste {fmtEur(s.costEur, 2)}
                        {s.estimated ? " · estimado" : ""}
                      </div>
                      {s.washSale ? (
                        <div className="text-[var(--warning)]">
                          Pérdida con recompra en ±2 meses: puede no ser computable aún.
                        </div>
                      ) : null}
                      {s.uncovered > 0 ? (
                        <div className="text-[var(--warning)]">
                          {fmtNumber(s.uncovered, 6)} sin coste conocido (vendes más de lo registrado).
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 tabular-nums ${
                        s.gainEur >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {s.gainEur >= 0 ? "+" : ""}
                      {fmtEur(s.gainEur, 2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="mt-3 text-[11px] text-[var(--muted)]">
              Orientativo, no es asesoramiento fiscal. FIFO por ticker con comisiones incluidas.
              Lo que tenías antes de la primera operación registrada se valora con tu precio medio
              y el tipo de cambio más antiguo (&quot;estimado&quot;). La cuota usa la escala del
              ahorro 2025 sin compensar pérdidas de otros años ni límites entre rentas. Compáralo
              con el informe fiscal de tu broker.
            </p>
          </>
        )}
      </div>
    </details>
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
      { header: "fee_eur", value: (t) => t.fee_eur ?? null },
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

function exportIncome(income: Income[]) {
  downloadCsv(
    `dividends-${stamp()}.csv`,
    toCsv(income, [
      { header: "date", value: (i) => i.date },
      { header: "ticker", value: (i) => i.ticker },
      { header: "gross_eur", value: (i) => i.gross_eur },
      { header: "withholding_eur", value: (i) => i.withholding_eur },
      { header: "net_eur", value: (i) => Number(i.gross_eur) - Number(i.withholding_eur ?? 0) },
      { header: "account", value: (i) => i.account },
      { header: "note", value: (i) => i.note },
    ]),
  );
}

function exportTax(y: TaxYear) {
  downloadCsv(
    `fiscal-${y.year}-${stamp()}.csv`,
    toCsv(y.sales, [
      { header: "date", value: (s) => s.date },
      { header: "ticker", value: (s) => s.ticker },
      { header: "shares", value: (s) => s.shares },
      { header: "proceeds_eur", value: (s) => Number(s.proceedsEur.toFixed(2)) },
      { header: "cost_eur", value: (s) => Number(s.costEur.toFixed(2)) },
      { header: "gain_eur", value: (s) => Number(s.gainEur.toFixed(2)) },
      { header: "estimated", value: (s) => (s.estimated ? "yes" : "no") },
      { header: "two_month_rule", value: (s) => (s.washSale ? "yes" : "no") },
    ]),
  );
}
