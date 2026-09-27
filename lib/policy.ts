import type { Category, Role } from "./types";

export const POLICY = {
  liquidityTargetEur: 3600,
  monthlyExpensesEur: 600,
  monthlyContributionEur: 200,
  mstrTargetUsd: 450,
  mstrExitBandUsd: { min: 400, max: 425 },
} as const;

export const CATEGORY_COLORS: Record<Category, string> = {
  Crypto: "#F7931A",
  "Crypto Proxy": "#FF6B35",
  "Gold Miners": "#D4AF37",
  Equities: "#4A9EFF",
  Liquidez: "#52D9A4",
};

export const CATEGORY_TARGETS: Record<Category, number> = {
  Crypto: 35,
  "Crypto Proxy": 20,
  "Gold Miners": 15,
  Equities: 20,
  Liquidez: 10,
};

export const ROLE_INFO: Record<Role, { label: string; rule: string }> = {
  core: { label: "Núcleo", rule: "Largo plazo. No vender salvo cambio de tesis." },
  tactica: { label: "Táctica", rule: "Recoger beneficios al llegar al precio objetivo." },
  cobertura: { label: "Cobertura", rule: "Protege frente a inflación o al núcleo. Mantener." },
  complemento: { label: "Complemento", rule: "Exposición extra con peso limitado." },
  caja: { label: "Caja", rule: "Liquidez operativa. Sin riesgo de mercado." },
  residual: { label: "Residual", rule: "Sin tesis activa. Simplificar cuando se pueda." },
};
