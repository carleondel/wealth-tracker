"use client";

import { useEffect, useState } from "react";
import { Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtEur } from "@/lib/format";
import { getAccruedInterest } from "@/lib/calculations";
import type { Category, ManualAsset, Platform } from "@/lib/types";

const CATEGORIES: Category[] = [
  "Liquidez",
  "Crypto",
  "Crypto Proxy",
  "Gold Miners",
  "Equities",
];
const PLATFORMS: Platform[] = ["Revolut", "BBVA", "Binance", "IBKR", "Wallet"];

export interface AssetPayload {
  name: string;
  value_eur: number;
  category: Category;
  platform: Platform;
  rate_label: string | null;
  interest_rate_annual: number;
}

interface Props {
  open: boolean;
  asset: ManualAsset | null;
  onCancel: () => void;
  onSave: (payload: AssetPayload, id: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onApplyInterest?: (asset: ManualAsset) => Promise<void>;
}

export function EditAssetModal({
  open,
  asset,
  onCancel,
  onSave,
  onDelete,
  onApplyInterest,
}: Props) {
  const [form, setForm] = useState<AssetPayload>(blank());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setDeleting(false);
    setApplying(false);
    if (asset) {
      setForm({
        name: asset.name,
        value_eur: Number(asset.value_eur) || 0,
        category: asset.category,
        platform: asset.platform,
        rate_label: asset.rate_label,
        interest_rate_annual: Number(asset.interest_rate_annual) || 0,
      });
    } else {
      setForm(blank());
    }
  }, [open, asset]);

  if (!open) return null;

  const accrual = asset ? getAccruedInterest(asset) : null;

  function update<K extends keyof AssetPayload>(key: K, value: AssetPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.name.trim()) {
      setErr("Nombre obligatorio.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(
        {
          ...form,
          name: form.name.trim(),
          value_eur: Number(form.value_eur) || 0,
          interest_rate_annual: Number(form.interest_rate_annual) || 0,
          rate_label: form.rate_label?.trim() || null,
        },
        asset?.id ?? null,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!asset?.id || !onDelete) return;
    if (!confirm(`¿Eliminar ${asset.name}?`)) return;
    setDeleting(true);
    try {
      await onDelete(asset.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  async function applyInterest() {
    if (!asset || !onApplyInterest) return;
    setApplying(true);
    try {
      await onApplyInterest(asset);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-widest text-[var(--muted)]">
            {asset ? `Editar ${asset.name}` : "Nueva cuenta"}
          </h2>
          <button
            onClick={onCancel}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {accrual && accrual.accruedEur > 0.01 ? (
          <div className="mb-4 rounded-md border border-[var(--accent)]/50 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2.5 flex items-center gap-3">
            <Zap size={14} className="text-[var(--accent)]" />
            <div className="text-xs flex-1">
              <div className="font-semibold">
                +{fmtEur(accrual.accruedEur, 2)} acumulados
              </div>
              <div className="text-[var(--muted)]">
                Desde el último update ({accrual.days.toFixed(0)} días al{" "}
                {((asset?.interest_rate_annual ?? 0) * 100).toFixed(2)}% TAE)
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={applyInterest}
              disabled={applying}
            >
              {applying ? "Aplicando…" : "Aplicar ahora"}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ahorro Remunerado"
              className={input}
            />
          </Field>
          <Field label="Valor EUR">
            <input
              type="number"
              step="any"
              value={form.value_eur}
              onChange={(e) => update("value_eur", Number(e.target.value))}
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

          <Field label="Tipo de interés anual (%)">
            <input
              type="number"
              step="0.01"
              value={Number.isFinite(form.interest_rate_annual)
                ? Number((form.interest_rate_annual * 100).toFixed(4))
                : 0}
              onChange={(e) =>
                update(
                  "interest_rate_annual",
                  (Number(e.target.value) || 0) / 100,
                )
              }
              placeholder="1.25"
              className={input}
            />
          </Field>
          <Field label="Etiqueta (opcional)">
            <input
              value={form.rate_label ?? ""}
              onChange={(e) => update("rate_label", e.target.value)}
              placeholder="1.25% TAE"
              className={input}
            />
          </Field>
        </div>

        {form.interest_rate_annual > 0 ? (
          <div className="mt-3 text-[11px] text-[var(--muted)]">
            <Badge variant="muted">INFO</Badge>{" "}
            El interés se acumula de forma lineal. Puedes aplicarlo al saldo con
            un click cuando abras la cuenta otra vez.
          </div>
        ) : null}

        {err ? (
          <div className="mt-4 rounded-md border border-[var(--danger)]/60 bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] px-3 py-2 text-xs">
            {err}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          {asset && onDelete ? (
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
              {saving ? "Guardando…" : asset ? "Guardar" : "Añadir"}
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

function blank(): AssetPayload {
  return {
    name: "",
    value_eur: 0,
    category: "Liquidez",
    platform: "Revolut",
    rate_label: null,
    interest_rate_annual: 0,
  };
}

const input =
  "bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]";
