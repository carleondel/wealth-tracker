"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  describeOp,
  type JournalOp,
  type JournalResponse,
} from "@/lib/journal-ops";
import type { ManualAsset, Position } from "@/lib/types";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  onApply: (ops: JournalOp[]) => Promise<{ applied: number; failed: string[] }>;
}

const EXAMPLES = [
  "vendí 3 MSTR a 180 y compré 2 NVDA a 440",
  "aporté 200 al Ahorro Remunerado de nómina",
  "el saldo de Cuenta Corriente ahora es 2200",
  "precio medio de NVDA 420 y objetivo 500",
];

export function JournalTab({ positions, manualAssets, onApply }: Props) {
  const [text, setText] = useState("");
  const [ops, setOps] = useState<JournalOp[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [raw, setRaw] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; failed: string[] } | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function parse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    setErr(null);
    setResult(null);
    setOps([]);
    setSelected(new Set());
    setRaw(null);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          tickers: positions.map((p) => p.ticker),
          assetNames: manualAssets.map((a) => a.name),
          today,
        }),
      });
      const data = (await res.json()) as JournalResponse;
      if (data.error) setErr(data.error);
      setOps(data.operations ?? []);
      setSelected(new Set((data.operations ?? []).map((_, i) => i)));
      if (data.raw) setRaw(data.raw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
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
        setText("");
        setRaw(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={12} className="text-[var(--accent)]" /> Journal
            </span>
          </CardTitle>
          <Badge variant="muted">NVIDIA NIM</Badge>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Escribe lo que ha pasado en tu cartera. El modelo lo parsea a
          operaciones estructuradas y tú decides qué aplicar antes de tocar la
          base de datos.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="ej. vendí 5 MSTR a 180 y aporté 200 a Revolut de nómina"
          className="mt-4 w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setText(ex)}
              className="text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end">
          <Button onClick={parse} disabled={parsing || !text.trim()}>
            <Wand2 size={12} className={parsing ? "animate-pulse" : ""} />
            {parsing ? "Parseando…" : "Parsear"}
          </Button>
        </div>
      </Card>

      {err ? (
        <Card className="border-[var(--danger)]/60">
          <div className="text-sm text-[var(--danger)]">{err}</div>
          {raw ? (
            <details className="mt-2 text-xs text-[var(--muted)]">
              <summary className="cursor-pointer">Respuesta cruda del modelo</summary>
              <pre className="mt-2 whitespace-pre-wrap">{raw}</pre>
            </details>
          ) : null}
        </Card>
      ) : null}

      {ops.length > 0 ? (
        <Card>
          <CardTitle>Operaciones detectadas ({ops.length})</CardTitle>
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
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{opTypeLabel(op.type)}</Badge>
                  </div>
                  <div className="mt-1">{describeOp(op, positions, manualAssets)}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">
              {selected.size} de {ops.length} seleccionada(s)
            </span>
            <Button onClick={apply} disabled={applying || selected.size === 0}>
              <Check size={12} />
              {applying ? "Aplicando…" : "Aplicar seleccionadas"}
            </Button>
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
