"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category, Platform, Position, Role } from "@/lib/types";

const CATEGORIES: Category[] = [
  "Crypto",
  "Crypto Proxy",
  "Gold Miners",
  "Equities",
  "Liquidez",
];
const PLATFORMS: Platform[] = ["Binance", "IBKR", "Wallet", "Revolut", "BBVA"];
const ROLES: Role[] = [
  "core",
  "tactica",
  "cobertura",
  "complemento",
  "caja",
  "residual",
];

export interface PositionPayload {
  ticker: string;
  name: string;
  shares: number;
  avg_price_usd: number | null;
  target_price_usd: number | null;
  category: Category;
  platform: Platform;
  role: Role;
  is_crypto: boolean;
}

interface Props {
  open: boolean;
  position: Position | null; // null = new position
  onCancel: () => void;
  onSave: (payload: PositionPayload, id: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function EditPositionModal({
  open,
  position,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const [form, setForm] = useState<PositionPayload>(blank());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setDeleting(false);
    if (position) {
      setForm({
        ticker: position.ticker,
        name: position.name,
        shares: Number(position.shares) || 0,
        avg_price_usd:
          position.avg_price_usd != null ? Number(position.avg_price_usd) : null,
        target_price_usd:
          position.target_price_usd != null
            ? Number(position.target_price_usd)
            : null,
        category: position.category,
        platform: position.platform,
        role: position.role,
        is_crypto: position.is_crypto,
      });
    } else {
      setForm(blank());
    }
  }, [open, position]);

  if (!open) return null;

  function update<K extends keyof PositionPayload>(
    key: K,
    value: PositionPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.ticker.trim() || !form.name.trim()) {
      setErr("Ticker y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(
        {
          ...form,
          ticker: form.ticker.trim().toUpperCase(),
          name: form.name.trim(),
          shares: Number(form.shares) || 0,
        },
        position?.id ?? null,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!position?.id || !onDelete) return;
    if (!confirm(`¿Eliminar ${position.ticker} (${position.name})?`)) return;
    setDeleting(true);
    setErr(null);
    try {
      await onDelete(position.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-widest text-[var(--muted)]">
            {position ? `Editar ${position.ticker}` : "Nueva posición"}
          </h2>
          <button
            onClick={onCancel}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ticker">
            <input
              value={form.ticker}
              onChange={(e) => update("ticker", e.target.value)}
              placeholder="MSTR, BTC-USD"
              className={input}
            />
          </Field>
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="MicroStrategy"
              className={input}
            />
          </Field>

          <Field label="Shares / unidades">
            <input
              type="number"
              step="any"
              value={form.shares}
              onChange={(e) => update("shares", Number(e.target.value))}
              className={input}
            />
          </Field>
          <Field label="Precio medio USD (opcional)">
            <input
              type="number"
              step="any"
              value={form.avg_price_usd ?? ""}
              onChange={(e) =>
                update(
                  "avg_price_usd",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="Se usa para calcular P&L"
              className={input}
            />
          </Field>

          <Field label="Precio objetivo USD (opcional)">
            <input
              type="number"
              step="any"
              value={form.target_price_usd ?? ""}
              onChange={(e) =>
                update(
                  "target_price_usd",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className={input}
            />
          </Field>
          <Field label="Categoría">
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value as Category)}
              className={input}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Plataforma">
            <select
              value={form.platform}
              onChange={(e) => update("platform", e.target.value as Platform)}
              className={input}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rol">
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value as Role)}
              className={input}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo">
            <label className="flex items-center gap-2 text-sm mt-1.5">
              <input
                type="checkbox"
                checked={form.is_crypto}
                onChange={(e) => update("is_crypto", e.target.checked)}
              />
              Es cripto (se buscará en CoinGecko)
            </label>
          </Field>
        </div>

        {err ? (
          <div className="mt-4 rounded-md border border-[var(--danger)]/60 bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] px-3 py-2 text-xs">
            {err}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          {position && onDelete ? (
            <Button variant="danger" onClick={remove} disabled={deleting}>
              <Trash2 size={12} />
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : position ? "Guardar" : "Añadir"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
      <span className="uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function blank(): PositionPayload {
  return {
    ticker: "",
    name: "",
    shares: 0,
    avg_price_usd: null,
    target_price_usd: null,
    category: "Equities",
    platform: "IBKR",
    role: "complemento",
    is_crypto: false,
  };
}

const input =
  "bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]";
