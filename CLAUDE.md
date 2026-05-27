@AGENTS.md

# Wealth Tracker

Personal net-worth dashboard with auth + multi-tenancy. Each user sees only
their own data. Includes a public `/demo` route backed by fake in-memory data.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth magic link) via `@supabase/supabase-js`
- Recharts (charts) + Lucide (icons)
- Prices: free public APIs, no keys — CoinGecko (crypto), Stooq (US stocks),
  Frankfurter (USD/EUR)
- LLM: NVIDIA NIM hosted API (Llama 3.3 70B) for the natural-language Journal

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — lint

## Environment (`.env.local`, gitignored)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or the legacy JWT anon key
NVIDIA_API_KEY=nvapi-...                            # server-side only
NVIDIA_MODEL=meta/llama-3.3-70b-instruct           # optional, this is default
```

`NEXT_PUBLIC_*` are public-by-design (Supabase RLS enforces security).
`NVIDIA_API_KEY` never reaches the browser — only the `/api/journal` route uses it.

## Data model
SQL lives in `supabase/schema.sql` (base tables) and
`supabase/migrations/` (incremental changes). Run them in order in the Supabase
SQL editor. Seed data is **not** in SQL — each user clicks "Cargar datos de
ejemplo" to seed their own rows via `lib/seed.ts`.

Tables (all rows gated by `owner_id = auth.uid()`):
- `positions` — tickers held (shares, avg_price_usd, category, platform, role, target_price_usd, is_crypto)
- `manual_assets` — cash/savings accounts + `interest_rate_annual`
- `snapshots` — point-in-time net worth (total_eur, breakdown, prices, fx)
- `contributions` — recorded contributions (amount_eur, type, date)

## Auth flow
1. User lands on `/` → `components/login-screen.tsx` asks for email.
2. `signInWithOtp` sends a magic link to the email.
3. User clicks link → redirects to `/` with session tokens in URL hash.
4. `@supabase/supabase-js` parses the hash, sets the session, dashboard renders.
5. `components/dashboard.tsx` receives `userId` + `userEmail` as props and
   filters everything through Supabase RLS.

`/demo` bypasses auth entirely — it renders the same `Dashboard` with
`demoMode` prop which short-circuits every Supabase call to local state.

## Categories, roles, policy
- Colors: Crypto `#F7931A`, Crypto Proxy `#FF6B35`, Gold Miners `#D4AF37`,
  Equities `#4A9EFF`, Liquidez `#52D9A4`.
- Roles: `core` · `tactica` · `cobertura` · `complemento` · `caja` · `residual`.
- `lib/policy.ts` holds `POLICY` constants (liquidity target, MSTR exit bands…).
  These are currently global — future work may make them per-user.

## UI guidelines
- Dark theme, background `#080C18`, monospace font (Geist Mono).
- Six tabs: **Overview · Positions · Allocation · Policy · History · Journal**.
- Persistent top header: total EUR · USD/EUR · BTC/USD · UPDATE + pencil · last update.
- Values displayed in EUR. Asset prices shown in USD.
- FX/BTC editable inline (badges: LIVE / FALLBACK / MANUAL).

## How prices work
- Prices are **never** auto-fetched on page load.
- User clicks `UPDATE` → `/api/prices?tickers=…` → parallel fan-out to:
  - CoinGecko `simple/price?include_24hr_change=true` for crypto (BTC-USD, SOL-USD, XRP-USD, USDC-USD…).
  - Stooq single-symbol CSV per US stock ticker (`...q/l/?s=<ticker>.us&f=sd2t2ohlcv&h&e=csv`). Intraday % change derived from `(close − open) / open`.
  - Frankfurter (ECB reference) for USD→EUR.
- USDC and USDT are pinned to 1. Partial failures land in `errors[]` and
  surface as a banner; working tickers still save a snapshot.
- The pencil icon opens the manual-entry modal for overrides.

## How the Journal works
- `/api/journal` POST endpoint takes `{text, tickers, assetNames, today}`.
- Forwards to NVIDIA NIM (`https://integrate.api.nvidia.com/v1/chat/completions`) with a strict JSON-output prompt.
- Response is validated in `lib/journal-ops.ts` → only well-formed ops survive.
- The `JournalTab` shows a checkbox list of ops; `applyJournalOps` in the
  dashboard executes the checked ones against Supabase (or local state in demo).

## Project structure
```
app/
  layout.tsx
  page.tsx                   # auth gate (login vs dashboard)
  demo/page.tsx              # public demo, demoMode=true
  api/prices/route.ts        # CoinGecko + Stooq + Frankfurter aggregator
  api/journal/route.ts       # NVIDIA NIM parser → structured ops
components/
  dashboard.tsx              # all state + handlers (branches on demoMode)
  login-screen.tsx           # magic link form
  header.tsx
  update-prices-modal.tsx    # manual price entry fallback
  edit-position-modal.tsx    # CRUD positions
  edit-asset-modal.tsx       # CRUD manual assets + apply interest
  tabs/{overview,positions,allocation,policy,history,journal}.tsx
  ui/{card,badge,button,progress}.tsx
lib/
  supabase.ts                # client
  types.ts                   # Position, ManualAsset, Snapshot, Contribution…
  policy.ts                  # POLICY constants + category colors/targets
  calculations.ts            # P&L, breakdown, deviation, accrued interest
  format.ts                  # fmtEur, fmtUsd, fmtPct, fmtDateTime
  seed.ts                    # DEMO_POSITIONS / DEMO_MANUAL_ASSETS (fake data)
  demo.ts                    # makeDemo* + generateDemoSnapshots for /demo
  journal-ops.ts             # Op types, validator, describeOp
supabase/
  schema.sql                 # base tables
  migrations/
    001_snapshots_prices.sql
    002_multi_tenant.sql
    003_asset_interest.sql
```

## Secrets + repo hygiene
- `.env.local` is gitignored. Never commit real keys.
- `lib/seed.ts` contains **only fictitious** example data. Never put real
  holdings here — the repo will be published as portfolio.
- Supabase URL + publishable key are safe to document in the README (public by
  design, RLS enforces per-user access).
- `NVIDIA_API_KEY` is a secret: server-side only, never exposed in code.

## Behaviors to enforce
- Do **not** fetch prices on page load.
- Do **not** bypass RLS — always include `owner_id: userId` on inserts.
- Do **not** commit real portfolio numbers to `lib/seed.ts`.
- Do **not** add `demoMode` branches outside `dashboard.tsx` — keep demo
  detection in one place.
- Do **not** write tests yet.
- Keep commit messages focused on *why*, one or two sentences. Git commits are
  authored by the user directly; the assistant does not run `git commit`.
