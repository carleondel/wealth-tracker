"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";
import { fmtEur, fmtDateTime, fmtPct } from "@/lib/format";

type PriceStatus = "LIVE" | "MANUAL" | "FALLBACK";

interface Props {
  totalEur: number;
  dayChange: { eur: number; pct: number } | null;
  usdEur: number;
  btcUsd: number;
  fxStatus: PriceStatus;
  btcStatus: PriceStatus;
  lastUpdated: string | null;
  onUpdate: () => void;
  onManualEdit: () => void;
  updating: boolean;
}

/** Height of the compact bar, excluding the safe-area inset. */
const COMPACT_BAR_PX = 52;

export function Header({
  totalEur,
  dayChange,
  usdEur,
  btcUsd,
  fxStatus,
  btcStatus,
  lastUpdated,
  onUpdate,
  onManualEdit,
  updating,
}: Props) {
  const up = (dayChange?.eur ?? 0) >= 0;
  const headerRef = useRef<HTMLElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);

  // Phones: the full header scrolls away with the page and a one-line bar
  // slides in once it's hidden behind it (iOS large-title pattern). Nothing
  // in the layout changes size, so the scroll position never jumps.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { rootMargin: `-${COMPACT_BAR_PX}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const updateIcon = <RefreshCw size={12} className={updating ? "animate-spin" : ""} />;
  const pencil = (className: string) => (
    <button
      onClick={onManualEdit}
      className={`flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] rounded-md border border-[var(--border)] hover:border-[var(--muted)] ${className}`}
      title="Editar precios manualmente"
      aria-label="Editar precios manualmente"
    >
      <Pencil size={12} />
    </button>
  );

  return (
    <>
      <header
        ref={headerRef}
        className="border-b border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-sm sm:sticky sm:top-0 z-40"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:py-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--muted)]">
              <LogoMark size={16} />
              Patrimonio total
            </span>
            <span className="text-2xl sm:text-3xl font-semibold tabular-nums leading-none mt-1 truncate">
              {fmtEur(totalEur)}
            </span>
            {dayChange ? (
              <span
                className={`mt-1 text-xs tabular-nums ${
                  up ? "text-[var(--accent)]" : "text-[var(--danger)]"
                }`}
              >
                {up ? "+" : ""}
                {fmtEur(dayChange.eur)} ({fmtPct(dayChange.pct)}){" "}
                <span className="text-[var(--muted)]">hoy</span>
              </span>
            ) : null}
          </div>

          <div className="order-last sm:order-none basis-full sm:basis-auto flex gap-2">
            <RateChip label="USD/EUR" value={usdEur.toFixed(4)} status={fxStatus} onClick={onManualEdit} />
            <RateChip label="BTC" value={`$${Math.round(btcUsd).toLocaleString("en-US")}`} status={btcStatus} onClick={onManualEdit} />
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {pencil("size-9 sm:size-8")}
              <Button onClick={onUpdate} disabled={updating} className="h-9 sm:h-8">
                {updateIcon}
                {updating ? "Fetching" : "Update"}
              </Button>
            </div>
            <span className="text-[10px] text-[var(--muted)]">
              {lastUpdated ? fmtDateTime(lastUpdated) : "sin snapshots"}
            </span>
          </div>
        </div>
      </header>

      <div
        aria-hidden={!scrolledPast}
        inert={!scrolledPast}
        className={`sm:hidden fixed top-0 inset-x-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-sm pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out ${
          scrolledPast ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="px-4 flex items-center gap-3" style={{ height: COMPACT_BAR_PX }}>
          <div className="flex items-baseline gap-2 min-w-0 flex-1">
            <span className="text-lg font-semibold tabular-nums leading-none shrink-0">
              {fmtEur(totalEur)}
            </span>
            {dayChange ? (
              <span
                className={`text-xs tabular-nums truncate ${
                  up ? "text-[var(--accent)]" : "text-[var(--danger)]"
                }`}
              >
                {fmtPct(dayChange.pct)} <span className="text-[var(--muted)]">hoy</span>
              </span>
            ) : null}
          </div>
          {pencil("size-9")}
          <Button
            onClick={onUpdate}
            disabled={updating}
            className="size-9 px-0 justify-center"
            aria-label="Actualizar precios"
            title="Actualizar precios"
          >
            {updateIcon}
          </Button>
        </div>
      </div>
    </>
  );
}

function RateChip({
  label,
  value,
  status,
  onClick,
}: {
  label: string;
  value: string;
  status: PriceStatus;
  onClick: () => void;
}) {
  const dot =
    status === "LIVE"
      ? "bg-[var(--accent)]"
      : status === "MANUAL"
        ? "bg-[var(--warning)]"
        : "bg-[var(--muted)]";
  return (
    <button
      onClick={onClick}
      title={`${label} · ${status} — pulsa para editar`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] tabular-nums hover:border-[var(--muted)]"
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      <span className="uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </button>
  );
}
