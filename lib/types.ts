export type Category =
  | "Crypto"
  | "Crypto Proxy"
  | "Gold Miners"
  | "Equities"
  | "Liquidez";

export type Role =
  | "core"
  | "tactica"
  | "cobertura"
  | "complemento"
  | "caja"
  | "residual";

export type Platform = "Binance" | "IBKR" | "Wallet" | "Revolut" | "BBVA";

export interface Position {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  avg_price_usd: number | null;
  category: Category;
  platform: Platform;
  role: Role;
  target_price_usd: number | null;
  is_crypto: boolean;
  created_at: string;
}

export interface ManualAsset {
  id: string;
  name: string;
  value_eur: number;
  category: Category;
  platform: Platform;
  rate_label: string | null;
  /** Annual rate as decimal (0.0125 = 1.25% TAE). 0 if not interest-bearing. */
  interest_rate_annual: number;
  updated_at: string;
}

export type Breakdown = Partial<Record<Category, number>>;

export interface Snapshot {
  id: string;
  total_eur: number;
  breakdown: Breakdown;
  prices: PriceMap;
  usd_eur_rate: number;
  btc_price_usd: number;
  created_at: string;
}

export type ContributionType = "liquidez" | "inversion" | "nomina" | "otro";

export interface Contribution {
  id: string;
  amount_eur: number;
  type: ContributionType;
  note: string | null;
  date: string;
  created_at: string;
}

/** Live prices keyed by ticker. `change` is the daily percent move. */
export type PriceMap = Record<string, { price: number; change: number }>;

export interface PricesResult {
  usdEur: number;
  btcUsd: number;
  prices: PriceMap;
}
