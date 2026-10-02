@AGENTS.md

# Wealth Tracker

Personal net-worth dashboard with auth + multi-tenancy. Each user sees only
their own data. Includes a public `/demo` route backed by fake in-memory data.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth magic link) via `@supabase/supabase-js`
- Recharts (charts) + Lucide (icons)
- Prices: free public APIs, no keys — CoinGecko (crypto), Finnhub (US stocks),
  Frankfurter (USD/EUR)

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — lint

## Environment (`.env.local`, gitignored)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or the legacy JWT anon key
```

`NEXT_PUBLIC_*` are public-by-design (Supabase RLS enforces security).

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
- `user_settings` — one row per user: `category_targets` jsonb (target % per category)

## Auth flow
1. User lands on `/` → `components/login-screen.tsx` asks for email.
2. `signInWithOtp` sends an email with a magic link **and** a one-time code
   (the Supabase "Magic Link" template must include `{{ .Token }}`).
3. Either the user types the code → `verifyOtp({ email, token, type: "email" })`,
   or clicks the link → redirects to `/` with session tokens in the URL hash,
   which `@supabase/supabase-js` parses.
4. The code path is required for the iOS home-screen app: it has its own
   storage, so a link opened in Safari never logs the installed app in.
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
- `CATEGORY_TARGETS` in `policy.ts` are only the **defaults**; the effective
  targets come from `user_settings.category_targets` (loaded in `dashboard.tsx`,
  edited in the "Asignación vs objetivo" card).

## UI guidelines
- Dark theme, background `#080C18`, monospace font (Geist Mono).
- Three tabs: **Resumen** (`overview.tsx`: P&L + evolution chart, distribution,
  liquidity, plan) · **Cartera** (`portfolio.tsx`: allocation vs target, positions
  grouped by category, collapsible simulator) · **Movimientos** (`journal.tsx`:
  manual ops + contributions history).
- Persistent top header: total EUR + today's change · USD/EUR and BTC chips · UPDATE + pencil · last update.
- Values displayed in EUR. Asset prices shown in USD.
- FX/BTC chips show a status dot (LIVE / FALLBACK / MANUAL); clicking them opens
  the pencil modal to override.
- Role explanations live in `ROLE_INFO` (`lib/policy.ts`) and show as tooltips.

## How prices work
- Prices are **never** auto-fetched on page load.
- User clicks `UPDATE` → `/api/prices?tickers=…` → parallel fan-out to:
  - CoinGecko `simple/price?include_24hr_change=true` for crypto (BTC-USD, SOL-USD, XRP-USD, USDC-USD…).
  - Finnhub single-symbol CSV per US stock ticker (`...q/l/?s=<ticker>.us&f=sd2t2ohlcv&h&e=csv`). Intraday % change derived from `(close − open) / open`.
  - Frankfurter (ECB reference) for USD→EUR.
- USDC and USDT are pinned to 1. Partial failures land in `errors[]` and
  surface as a banner; working tickers still save a snapshot.
- The pencil icon opens the manual-entry modal for overrides.

## How the Journal works
- `components/manual-op-form.tsx` builds ops (buy, sell, deposit, withdraw) typed in `lib/journal-ops.ts`.
- The `JournalTab` shows a checkbox list of ops; `applyJournalOps` in the
  dashboard executes the checked ones against Supabase (or local state in demo).

## Project structure
```
app/
  layout.tsx
  page.tsx                   # auth gate (login vs dashboard)
  icon.tsx / apple-icon.tsx  # PNG icons rendered from LogoMark
  manifest.ts                # PWA manifest
  demo/page.tsx              # public demo, demoMode=true
  api/prices/route.ts        # CoinGecko + Finnhub + Frankfurter aggregator
components/
  dashboard.tsx              # all state + handlers (branches on demoMode)
  login-screen.tsx           # email → OTP code (or magic link)
  logo.tsx                   # LogoMark SVG (UI + generated icons)
  header.tsx
  update-prices-modal.tsx    # manual price entry fallback
  edit-position-modal.tsx    # CRUD positions
  edit-asset-modal.tsx       # CRUD manual assets + apply interest
  tabs/{overview,portfolio,journal}.tsx
  ui/{card,badge,button,progress}.tsx
lib/
  supabase.ts                # client
  types.ts                   # Position, ManualAsset, Snapshot, Contribution…
  policy.ts                  # POLICY constants, category colors/targets, ROLE_INFO
  calculations.ts            # P&L, breakdown, deviation, accrued interest
  format.ts                  # fmtEur, fmtUsd, fmtPct, fmtDateTime
  seed.ts                    # DEMO_POSITIONS / DEMO_MANUAL_ASSETS (fake data)
  demo.ts                    # makeDemo* + generateDemoSnapshots for /demo
  journal-ops.ts             # Op types, describeOp
supabase/
  schema.sql                 # base tables
  migrations/
    001_snapshots_prices.sql
    002_multi_tenant.sql
    003_asset_interest.sql
    004_user_settings.sql
```

## Secrets + repo hygiene
- `.env.local` is gitignored. Never commit real keys.
- `lib/seed.ts` contains **only fictitious** example data. Never put real
  holdings here — the repo will be published as portfolio.
- Supabase URL + publishable key are safe to document in the README (public by
  design, RLS enforces per-user access).

## Behaviors to enforce
- Do **not** fetch prices on page load.
- Do **not** bypass RLS — always include `owner_id: userId` on inserts.
- Do **not** commit real portfolio numbers to `lib/seed.ts`.
- Do **not** add `demoMode` branches outside `dashboard.tsx` — keep demo
  detection in one place.
- Do **not** write tests yet.
- Keep commit messages focused on *why*, one or two sentences. Git commits are
  authored by the user directly; the assistant does not run `git commit`.
