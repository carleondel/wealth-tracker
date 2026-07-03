"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JournalOp } from "@/lib/journal-ops";
import type { ManualAsset, Position } from "@/lib/types";

type Kind = "buy" | "sell" | "deposit" | "withdraw";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  onAdd: (op: JournalOp) => void;
}

export function ManualOpForm({ positions, manualAssets, onAdd }: Props) {
  const [kind, setKind] = useState<Kind>("buy");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [assetName, setAssetName] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isPos = kind === "buy" || kind === "sell";

  function reset() {
    setTicker("");
    setShares("");
    setPriceUsd("");
    setAssetName("");
    setAmountEur("");
    setIsExternal(false);
    setErr(null);
  }

  function submit() {
    setErr(null);
    if (isPos) {
      const s = Number(shares);
      if (!ticker.trim() || !Number.isFinite(s) || s <= 0) {
        setErr("Falta ticker o cantidad válida.");
        return;
      }
      const p = Number(priceUsd);
      const delta = kind === "buy" ? s : -s;
      onAdd({
        type: "adjust_position",
        ticker: ticker.trim().toUpperCase(),
        delta_shares: delta,
        price_usd: Number.isFinite(p) && p > 0 ? p : null,
      });
    } else {
      const a = Number(amountEur);
      if (!assetName.trim() || !Number.isFinite(a) || a <= 0) {
        setErr("Falta cuenta o importe válido.");
        return;
      }
      const delta = kind === "deposit" ? a : -a;
      onAdd({
        type: "adjust_asset",
        name: assetName.trim(),
        delta_eur: delta,
      });
      if (kind === "deposit" && isExternal) {
        onAdd({
          type: "contribute",
          amount_eur: a,
          contribution_type: "nomina",
          note: assetName.trim(),
          date: new Date().toISOString().slice(0, 10),
        });
      }
    }
    reset();
  }

  const inputClass =
    "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]";

  return (
    <Card>
      <CardTitle>Añadir manualmente</CardTitle>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Sin IA. Construye la operación con dropdowns e inputs y añádela a la
        lista de abajo.
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {(["buy", "sell", "deposit", "withdraw"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setErr(null);
            }}
            className={`text-xs px-2 py-1.5 rounded border transition-colors ${
              kind === k
                ? "border-[var(--accent)] text-[var(--foreground)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
            }`}
          >
            {kindLabel(k)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {isPos ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Ticker">
              <input
                list="manual-ticker-list"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="BTC-USD"
                className={inputClass}
              />
              <datalist id="manual-ticker-list">
                {positions.map((p) => (
                  <option key={p.id} value={p.ticker} />
                ))}
              </datalist>
            </Field>
            <Field label="Cantidad">
              <input
                type="number"
                step="any"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0.1"
                className={inputClass}
              />
            </Field>
            <Field label="Precio USD (opcional)">
              <input
                type="number"
                step="any"
                min="0"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                placeholder="65000"
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Cuenta">
              <input
                list="manual-asset-list"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Cuenta Remunerada"
                className={inputClass}
              />
              <datalist id="manual-asset-list">
                {manualAssets.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Importe €">
              <input
                type="number"
                step="any"
                min="0"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                placeholder="500"
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </div>

      {isPos ? (
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Sin precio: solo se ajustan las shares. Con precio: se recalcula el
          coste medio ponderado.
        </p>
      ) : null}

      {kind === "deposit" ? (
        <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>
            Es dinero externo (nómina, ahorro nuevo…)
            <span className="text-[var(--muted)]"> — se registra también como aportación</span>
          </span>
        </label>
      ) : null}

      {err ? (
        <div className="mt-3 text-xs text-[var(--danger)]">{err}</div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button onClick={submit}>
          <Plus size={12} /> Añadir a la lista
        </Button>
      </div>
    </Card>
  );
}

function kindLabel(k: Kind): string {
  switch (k) {
    case "buy":
      return "Compra";
    case "sell":
      return "Venta";
    case "deposit":
      return "Depósito";
    case "withdraw":
      return "Retirada";
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--muted)] uppercase tracking-wider text-[10px]">
        {label}
      </span>
      {children}
    </label>
  );
}
