"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { parsePricesJson } from "@/lib/prices";
import type { Position, PriceMap, PricesResult } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  positions: Position[];
  current: PricesResult;
  onCancel: () => void;
  onSave: (result: PricesResult) => Promise<void> | void;
}

export function UpdatePricesModal({
  open,
  positions,
  current,
  onCancel,
  onSave,
}: Props) {
  const tickers = useMemo(() => positions.map((p) => p.ticker), [positions]);
  const [usdEur, setUsdEur] = useState(current.usdEur);
  const [btcUsd, setBtcUsd] = useState(current.btcUsd);
  const [rows, setRows] = useState<Record<string, string>>({});
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsdEur(current.usdEur);
    setBtcUsd(current.btcUsd);
    const seeded: Record<string, string> = {};
    for (const t of tickers) {
      const v = current.prices[t]?.price;
      seeded[t] = v != null ? String(v) : "";
    }
    setRows(seeded);
    setJsonInput("");
    setJsonError(null);
  }, [open, current, tickers]);

  if (!open) return null;

  function updateRow(ticker: string, value: string) {
    setRows((prev) => ({ ...prev, [ticker]: value }));
  }

  function applyJson() {
    try {
      const parsed = parsePricesJson(jsonInput);
      if (parsed.usdEur != null) setUsdEur(parsed.usdEur);
      if (parsed.btcUsd != null) setBtcUsd(parsed.btcUsd);
      if (parsed.prices) {
        setRows((prev) => {
          const next = { ...prev };
          for (const [t, v] of Object.entries(parsed.prices!)) {
            next[t] = String(v.price);
          }
          return next;
        });
      }
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Parse error");
    }
  }

  async function save() {
    const priceMap: PriceMap = {};
    for (const [t, raw] of Object.entries(rows)) {
      const n = Number(raw);
      if (raw && Number.isFinite(n)) {
        priceMap[t] = {
          price: n,
          change: current.prices[t]?.change ?? 0,
        };
      }
    }
    const btcEntry = priceMap["BTC-USD"];
    const resolvedBtc =
      btcEntry?.price ?? (Number.isFinite(btcUsd) ? btcUsd : 0);
    if (!priceMap["BTC-USD"] && resolvedBtc > 0) {
      priceMap["BTC-USD"] = { price: resolvedBtc, change: 0 };
    }

    setSaving(true);
    try {
      await onSave({
        usdEur: Number(usdEur) || current.usdEur,
        btcUsd: resolvedBtc,
        prices: priceMap,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-widest text-[var(--muted)]">
            Update prices
          </h2>
          <button
            onClick={onCancel}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <FieldNumber
            label="USD/EUR"
            value={usdEur}
            onChange={setUsdEur}
            step={0.0001}
          />
          <FieldNumber
            label="BTC/USD"
            value={btcUsd}
            onChange={setBtcUsd}
            step={1}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
          {positions.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-[var(--muted)] uppercase">
                {p.ticker}
              </span>
              <input
                className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                value={rows[p.ticker] ?? ""}
                onChange={(e) => updateRow(p.ticker, e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </label>
          ))}
        </div>

        <details className="mb-5 text-xs">
          <summary className="cursor-pointer text-[var(--muted)] uppercase tracking-wider">
            Paste JSON
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={6}
              placeholder='{"USD/EUR": 0.85, "BTC-USD": 77500, "MSTR": 164.2, "NVDA": 892.1}'
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[var(--danger)]">{jsonError}</span>
              <Button variant="ghost" onClick={applyJson} type="button">
                Apply JSON
              </Button>
            </div>
          </div>
        </details>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save snapshot"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
