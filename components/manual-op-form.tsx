"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JournalOp } from "@/lib/journal-ops";
import { localDateIso } from "@/lib/format";
import type { ManualAsset, Position } from "@/lib/types";

type Kind = "buy" | "sell" | "deposit" | "withdraw" | "dividend";

/** Where the cash of a buy/sell comes from / goes to. */
const FUNDING_EXTERNAL = "__external__";
const FUNDING_NONE = "__none__";

interface Props {
  positions: Position[];
  manualAssets: ManualAsset[];
  usdEur: number;
  onAdd: (op: JournalOp) => void;
}

export function ManualOpForm({ positions, manualAssets, usdEur, onAdd }: Props) {
  const [kind, setKind] = useState<Kind>("buy");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [assetName, setAssetName] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [funding, setFunding] = useState<string>(FUNDING_EXTERNAL);
  const [feeEur, setFeeEur] = useState("");
  const [withholdingEur, setWithholdingEur] = useState("");
  const [date, setDate] = useState(todayIso);
  const [err, setErr] = useState<string | null>(null);

  const isPos = kind === "buy" || kind === "sell";

  // Suggested EUR cost when shares + USD price are both filled in.
  const estimatedEur = (() => {
    const s = Number(shares);
    const p = Number(priceUsd);
    if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(p) || p <= 0) return null;
    return s * p * usdEur;
  })();

  function reset() {
    setTicker("");
    setShares("");
    setPriceUsd("");
    setAssetName("");
    setAmountEur("");
    setFeeEur("");
    setWithholdingEur("");
    setIsExternal(false);
    setErr(null);
  }

  function submit() {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr("Fecha inválida.");
      return;
    }
    if (kind === "dividend") {
      const gross = Number(amountEur);
      const wh = withholdingEur.trim() === "" ? 0 : Number(withholdingEur);
      if (!ticker.trim() || !Number.isFinite(gross) || gross <= 0) {
        setErr("Falta ticker o importe bruto válido.");
        return;
      }
      if (!Number.isFinite(wh) || wh < 0 || wh >= gross) {
        setErr("La retención tiene que ser menor que el bruto.");
        return;
      }
      if (!assetName.trim()) {
        setErr("Falta la cuenta donde entró el dinero.");
        return;
      }
      onAdd({
        type: "income",
        ticker: ticker.trim().toUpperCase(),
        gross_eur: gross,
        withholding_eur: wh,
        account: assetName.trim(),
        date,
      });
      reset();
      return;
    }
    if (isPos) {
      const s = Number(shares);
      if (!ticker.trim() || !Number.isFinite(s) || s <= 0) {
        setErr("Falta ticker o cantidad válida.");
        return;
      }
      const t = ticker.trim().toUpperCase();
      const p = Number(priceUsd);
      const eur = amountEur.trim() === "" ? estimatedEur : Number(amountEur);
      if (funding !== FUNDING_NONE && (eur == null || !Number.isFinite(eur) || eur <= 0)) {
        setErr("Falta el importe en € (o precio USD para estimarlo).");
        return;
      }
      const fee = feeEur.trim() === "" ? 0 : Number(feeEur);
      if (!Number.isFinite(fee) || fee < 0) {
        setErr("Comisión inválida.");
        return;
      }
      // Cash that actually moves: a buy pays the fee on top, a sell nets it.
      const cash = eur == null ? null : kind === "buy" ? eur + fee : eur - fee;
      onAdd({
        type: "adjust_position",
        ticker: t,
        delta_shares: kind === "buy" ? s : -s,
        price_usd: Number.isFinite(p) && p > 0 ? p : null,
        date,
        amount_eur: funding === FUNDING_NONE ? null : eur,
        funding:
          funding === FUNDING_NONE ? null : funding === FUNDING_EXTERNAL ? "external" : funding,
        fee_eur: fee > 0 ? fee : null,
      });
      // Counterpart: a buy consumes cash (or is new external money), a sell
      // produces cash (or leaves the portfolio). Keeps net worth and
      // market P&L neutral.
      if (funding === FUNDING_EXTERNAL && cash != null) {
        onAdd({
          type: "contribute",
          amount_eur: kind === "buy" ? cash : -cash,
          contribution_type: "inversion",
          note: `${kind === "buy" ? "compra" : "venta"} ${s} ${t}`,
          date,
        });
      } else if (funding !== FUNDING_NONE && cash != null) {
        onAdd({
          type: "adjust_asset",
          name: funding,
          delta_eur: kind === "buy" ? -cash : cash,
          date,
        });
      }
    } else {
      const a = Number(amountEur);
      if (!assetName.trim() || !Number.isFinite(a) || a <= 0) {
        setErr("Falta cuenta o importe válido.");
        return;
      }
      onAdd({
        type: "adjust_asset",
        name: assetName.trim(),
        delta_eur: kind === "deposit" ? a : -a,
        date,
      });
      if (isExternal) {
        onAdd({
          type: "contribute",
          amount_eur: kind === "deposit" ? a : -a,
          contribution_type: kind === "deposit" ? "nomina" : "otro",
          note: assetName.trim(),
          date,
        });
      }
    }
    reset();
  }

  const inputClass =
    "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-2 sm:py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]";

  const dateField = (
    <Field label="Fecha">
      <input
        type="date"
        value={date}
        max={todayIso()}
        onChange={(e) => setDate(e.target.value)}
        className={inputClass}
      />
    </Field>
  );

  return (
    <Card>
      <CardTitle>Añadir manualmente</CardTitle>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Construye la operación y añádela a la lista de abajo. No se guarda
        nada hasta que pulses Aplicar.
      </p>

      <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {(["buy", "sell", "deposit", "withdraw", "dividend"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setErr(null);
            }}
            className={`text-xs px-2 py-2 sm:py-1.5 rounded border transition-colors ${
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
        {kind === "dividend" ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Field label="Ticker">
              <input
                list="manual-ticker-list"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="KO"
                className={inputClass}
              />
            </Field>
            <Field label="Bruto €">
              <input
                type="number"
                step="any"
                min="0"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                placeholder="25"
                className={inputClass}
              />
            </Field>
            <Field label="Retención €">
              <input
                type="number"
                step="any"
                min="0"
                value={withholdingEur}
                onChange={(e) => setWithholdingEur(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Cobrado en">
              <input
                list="manual-asset-list"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Cuenta"
                className={inputClass}
              />
            </Field>
            <div className="col-span-2 sm:col-span-1">{dateField}</div>
          </div>
        ) : isPos ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
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
            {dateField}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            {dateField}
          </div>
        )}
      </div>

      {isPos ? (
        <>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Sin precio: solo se ajustan las shares. Con precio: se recalcula el
            coste medio ponderado.
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="col-span-2 sm:col-span-1">
            <Field label={kind === "buy" ? "Pagado con" : "Ingresado en"}>
              <select
                value={funding}
                onChange={(e) => setFunding(e.target.value)}
                className={inputClass}
              >
                <option value={FUNDING_EXTERNAL}>
                  {kind === "buy" ? "Dinero externo" : "Sale de la cartera"}
                </option>
                {manualAssets.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
                <option value={FUNDING_NONE}>Sin contrapartida</option>
              </select>
            </Field>
            </div>
            {funding !== FUNDING_NONE ? (
              <Field label="Importe €">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amountEur}
                  onChange={(e) => setAmountEur(e.target.value)}
                  placeholder={estimatedEur != null ? estimatedEur.toFixed(2) : "3000"}
                  className={inputClass}
                />
              </Field>
            ) : null}
            <Field label="Comisión €">
              <input
                type="number"
                step="any"
                min="0"
                value={feeEur}
                onChange={(e) => setFeeEur(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {funding === FUNDING_NONE
              ? "Solo se ajusta la posición. Ojo: el cambio de valor contará como rendimiento de mercado."
              : funding === FUNDING_EXTERNAL
                ? `Se registra como ${kind === "buy" ? "aportación" : "retirada"} para que no cuente como rendimiento. Importe vacío = estimado con precio USD × tipo de cambio.`
                : "Se descuenta/abona en esa cuenta. Patrimonio y rendimiento quedan neutros."}
          </p>
        </>
      ) : null}

      {kind === "dividend" ? (
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Entra en la cuenta el bruto menos la retención y cuenta como rendimiento, no como
          aportación.
        </p>
      ) : null}

      {kind === "deposit" || kind === "withdraw" ? (
        <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>
            {kind === "deposit"
              ? "Es dinero externo (nómina, ahorro nuevo…)"
              : "Sale de la cartera (gasto, transferencia fuera…)"}
            <span className="text-[var(--muted)]">
              {" "}— se registra como aportación {kind === "withdraw" ? "negativa " : ""}para no contar como rendimiento
            </span>
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

const todayIso = () => localDateIso();

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
    case "dividend":
      return "Dividendo";
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
