import type { Category } from "./types";

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
