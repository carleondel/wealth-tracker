"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { POLICY } from "@/lib/policy";
import { getActiveContributionRule, getTargetProgress } from "@/lib/calculations";
import { fmtEur, fmtUsd } from "@/lib/format";
import type { Breakdown, Position, PriceMap, Role } from "@/lib/types";

interface Props {
  breakdown: Breakdown;
  positions: Position[];
  prices: PriceMap;
}

const ROLE_INFO: Record<Role, { label: string; rule: string }> = {
  core: {
    label: "NÚCLEO",
    rule: "Mantener largo plazo. No vender salvo cambio fundamental de tesis.",
  },
  tactica: {
    label: "TÁCTICA",
    rule: "Recoger beneficios al objetivo de precio. Salida parcial/total según plan.",
  },
  cobertura: {
    label: "COBERTURA",
    rule: "Protege contra inflación o correlación negativa con el núcleo. Mantener.",
  },
  complemento: {
    label: "COMPLEMENTO",
    rule: "Exposición adicional, peso limitado. Revisar si tamaño < 1% del total.",
  },
  caja: {
    label: "CAJA",
    rule: "Liquidez operativa e inversa. No exponer a riesgo de mercado.",
  },
  residual: {
    label: "RESIDUAL",
    rule: "Posiciones heredadas o sin tesis activa. Simplificar cuando sea posible.",
  },
};

const CONTRIBUTION_RULES = [
  {
    id: "liquidez",
    label: "Liquidez < objetivo",
    detail: `→ ${fmtEur(POLICY.monthlyContributionEur)}/mes a cash hasta alcanzar ${fmtEur(POLICY.liquidityTargetEur)}`,
  },
  {
    id: "inversion",
    label: "Liquidez ≥ objetivo",
    detail: `→ ${fmtEur(POLICY.monthlyContributionEur)}/mes a inversión`,
  },
];

export function PolicyTab({ breakdown, positions, prices }: Props) {
  const rule = getActiveContributionRule(breakdown);
  const positionsWithTarget = positions.filter(
    (p) => p.target_price_usd != null,
  );

  const byRole = groupByRole(positions);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Política por rol</CardTitle>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Cada posición tiene un rol que define cómo la gestionas. Edítalo
          desde el tab Positions.
        </p>
        <div className="mt-4 space-y-3">
          {(Object.keys(ROLE_INFO) as Role[]).map((role) => {
            const info = ROLE_INFO[role];
            const items = byRole[role] ?? [];
            if (items.length === 0) return null;
            return (
              <div
                key={role}
                className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-l-2 border-[var(--border)] pl-3"
              >
                <div className="flex items-center gap-2 sm:w-32 shrink-0">
                  <Badge variant="muted">{info.label}</Badge>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--muted)]">{info.rule}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {items.map((p) => (
                      <span
                        key={p.id}
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--foreground)]"
                      >
                        {p.ticker}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Reglas de aportación</CardTitle>
        <div className="mt-4 space-y-3">
          {CONTRIBUTION_RULES.map((r) => {
            const active = r.id === rule.destination;
            return (
              <div
                key={r.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  active
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                    : "border-[var(--border)] bg-[var(--surface-2)]/30"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {r.label}
                    {active ? <Badge variant="accent">ACTIVA</Badge> : null}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {r.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {positionsWithTarget.length > 0 ? (
        <Card>
          <CardTitle>Alertas de precio</CardTitle>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Posiciones con precio objetivo. Edita `target_price_usd` en una
            posición para añadirla aquí.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            {positionsWithTarget.map((p) => {
              const currentPrice = prices[p.ticker]?.price;
              const target = p.target_price_usd ?? 0;
              const progress = getTargetProgress(currentPrice, target);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0"
                >
                  <div>
                    <span className="font-semibold">{p.ticker}</span>
                    <span className="text-[var(--muted)] ml-2 text-xs">
                      objetivo {fmtUsd(target, 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--muted)] tabular-nums">
                      {currentPrice != null ? fmtUsd(currentPrice) : "—"}
                    </span>
                    <Badge variant={progress.band === "exit" ? "accent" : "muted"}>
                      {progress.band === "exit" ? "alcanzado" : "pendiente"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function groupByRole(positions: Position[]): Record<Role, Position[]> {
  const out: Partial<Record<Role, Position[]>> = {};
  for (const p of positions) {
    if (!out[p.role]) out[p.role] = [];
    out[p.role]!.push(p);
  }
  return out as Record<Role, Position[]>;
}
