import type { Category, Platform, Role } from "./types";

export interface SeedPosition {
  ticker: string;
  name: string;
  shares: number;
  avg_price_usd: number | null;
  category: Category;
  platform: Platform;
  role: Role;
  is_crypto: boolean;
  target_price_usd: number | null;
}

export interface SeedManualAsset {
  name: string;
  value_eur: number;
  category: Category;
  platform: Platform;
  rate_label: string | null;
  interest_rate_annual: number;
}

export type TemplateId = "crypto-first" | "index-etf" | "dividend-income";

export interface Template {
  id: TemplateId;
  label: string;
  tagline: string;
  description: string;
  positions: SeedPosition[];
  manualAssets: SeedManualAsset[];
}

const CASH_ACCOUNTS_DEFAULT: SeedManualAsset[] = [
  { name: "Ahorro Remunerado", value_eur: 3500, category: "Liquidez", platform: "Revolut", rate_label: "2.0% TAE", interest_rate_annual: 0.02 },
  { name: "Cuenta Corriente",  value_eur: 1500, category: "Liquidez", platform: "BBVA",    rate_label: null,        interest_rate_annual: 0    },
];

/**
 * Templates shown on empty dashboard and in the public /demo route. All
 * numbers are fictitious — a starting point for each investment thesis.
 */
export const TEMPLATES: Template[] = [
  {
    id: "crypto-first",
    label: "Cripto-first",
    tagline: "BTC núcleo + MSTR + cobertura oro + megacaps",
    description:
      "Tesis agresiva con Bitcoin como núcleo, MicroStrategy táctica ($450 exit), mineras de oro como cobertura antiinflación y una selección de megacaps tech.",
    positions: [
      { ticker: "BTC-USD",  name: "Bitcoin",        shares: 0.5, avg_price_usd: null, category: "Crypto",       platform: "Binance", role: "core",        is_crypto: true,  target_price_usd: null },
      { ticker: "MSTR",     name: "MicroStrategy",  shares: 10,  avg_price_usd: null, category: "Crypto Proxy", platform: "IBKR",    role: "tactica",     is_crypto: false, target_price_usd: 450  },
      { ticker: "B",        name: "Barrick Mining", shares: 20,  avg_price_usd: null, category: "Gold Miners",  platform: "IBKR",    role: "cobertura",   is_crypto: false, target_price_usd: null },
      { ticker: "NEM",      name: "Newmont",        shares: 15,  avg_price_usd: null, category: "Gold Miners",  platform: "IBKR",    role: "cobertura",   is_crypto: false, target_price_usd: null },
      { ticker: "UNH",      name: "UnitedHealth",   shares: 2,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "NVDA",     name: "NVIDIA",         shares: 4,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "GOOGL",    name: "Alphabet",       shares: 2,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "AMZN",     name: "Amazon",         shares: 1,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "TSLA",     name: "Tesla",          shares: 1,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "MSFT",     name: "Microsoft",      shares: 1,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "META",     name: "Meta",           shares: 1,   avg_price_usd: null, category: "Equities",     platform: "IBKR",    role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "USDC-USD", name: "USD Coin",       shares: 100, avg_price_usd: null, category: "Liquidez",     platform: "Binance", role: "caja",        is_crypto: true,  target_price_usd: null },
      { ticker: "SOL-USD",  name: "Solana",         shares: 2,   avg_price_usd: null, category: "Crypto",       platform: "Binance", role: "residual",    is_crypto: true,  target_price_usd: null },
      { ticker: "XRP-USD",  name: "XRP",            shares: 50,  avg_price_usd: null, category: "Crypto",       platform: "Binance", role: "residual",    is_crypto: true,  target_price_usd: null },
    ],
    manualAssets: CASH_ACCOUNTS_DEFAULT,
  },
  {
    id: "index-etf",
    label: "Index ETF",
    tagline: "Cartera pasiva global (Bogleheads 4-fund)",
    description:
      "Tesis pasiva y diversificada: VOO (S&P 500), VXUS (internacional), BND (bonos US agregados), VNQ (REITs inmobiliarios). Mantener a largo, rebalancear anual.",
    positions: [
      { ticker: "VOO",  name: "Vanguard S&P 500",         shares: 30, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "core",        is_crypto: false, target_price_usd: null },
      { ticker: "VXUS", name: "Vanguard Intl Stock",      shares: 50, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "core",        is_crypto: false, target_price_usd: null },
      { ticker: "BND",  name: "Vanguard Total Bond",      shares: 25, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "cobertura",   is_crypto: false, target_price_usd: null },
      { ticker: "VNQ",  name: "Vanguard Real Estate",     shares: 10, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "complemento", is_crypto: false, target_price_usd: null },
    ],
    manualAssets: CASH_ACCOUNTS_DEFAULT,
  },
  {
    id: "dividend-income",
    label: "Dividendos",
    tagline: "ETFs y acciones con foco en ingreso pasivo",
    description:
      "Foco en renta: SCHD y VYM como núcleo de dividendos, JEPI para income mensual con covered calls, y tres dividend aristocrats (O, KO, T).",
    positions: [
      { ticker: "SCHD", name: "Schwab Dividend ETF",  shares: 40, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "core",        is_crypto: false, target_price_usd: null },
      { ticker: "VYM",  name: "Vanguard High Div ETF", shares: 25, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "core",        is_crypto: false, target_price_usd: null },
      { ticker: "JEPI", name: "JPMorgan Premium Inc.", shares: 30, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "tactica",     is_crypto: false, target_price_usd: null },
      { ticker: "O",    name: "Realty Income",         shares: 20, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "KO",   name: "Coca-Cola",             shares: 30, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "complemento", is_crypto: false, target_price_usd: null },
      { ticker: "T",    name: "AT&T",                  shares: 80, avg_price_usd: null, category: "Equities", platform: "IBKR", role: "complemento", is_crypto: false, target_price_usd: null },
    ],
    manualAssets: CASH_ACCOUNTS_DEFAULT,
  },
];

export function getTemplate(id: TemplateId): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Legacy exports used by the `/demo` route — defaults to the first template. */
export const DEMO_POSITIONS = TEMPLATES[0].positions;
export const DEMO_MANUAL_ASSETS = TEMPLATES[0].manualAssets;
