"use client";

import { Pencil, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtEur, fmtDateTime } from "@/lib/format";

type PriceStatus = "LIVE" | "MANUAL" | "FALLBACK";

interface Props {
  totalEur: number;
  usdEur: number;
  btcUsd: number;
  onEditUsdEur: (value: number) => void;
  onEditBtcUsd: (value: number) => void;
  fxStatus: PriceStatus;
  btcStatus: PriceStatus;
  lastUpdated: string | null;
  onUpdate: () => void;
  onManualEdit: () => void;
  updating: boolean;
}

export function Header({
  totalEur,
  usdEur,
  btcUsd,
  onEditUsdEur,
  onEditBtcUsd,
  fxStatus,
  btcStatus,
  lastUpdated,
  onUpdate,
  onManualEdit,
  updating,
}: Props) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Patrimonio total
          </span>
          <span className="text-4xl sm:text-5xl font-semibold tabular-nums leading-none mt-1">
            {fmtEur(totalEur)}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3 sm:ml-auto">
          <FxField
            label="USD/EUR"
            value={usdEur}
            step={0.0001}
            status={fxStatus}
            onChange={onEditUsdEur}
          />
          <FxField
            label="BTC/USD"
            value={btcUsd}
            step={1}
            status={btcStatus}
            onChange={onEditBtcUsd}
          />

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={onManualEdit}
                className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-md border border-[var(--border)] hover:border-[var(--muted)]"
                title="Editar precios manualmente"
                aria-label="Manual"
              >
                <Pencil size={12} />
              </button>
              <Button onClick={onUpdate} disabled={updating}>
                <RefreshCw
                  size={12}
                  className={updating ? "animate-spin" : ""}
                />
                {updating ? "Fetching" : "Update"}
              </Button>
            </div>
            <span className="text-[10px] text-[var(--muted)]">
              {lastUpdated ? fmtDateTime(lastUpdated) : "no snapshots yet"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function FxField({
  label,
  value,
  step,
  status,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  status: PriceStatus;
  onChange: (v: number) => void;
}) {
  const variant =
    status === "LIVE" ? "accent" : status === "MANUAL" ? "warning" : "muted";
  return (
    <label className="flex flex-col gap-1 text-[10px]">
      <span className="flex items-center gap-2 uppercase tracking-wider text-[var(--muted)]">
        {label}
        <Badge variant={variant}>{status}</Badge>
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
